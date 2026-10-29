import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, forumThreads, groups, media, messages, moderationActions, moderationFlags, posts, reviews, sessions, stories, users } from "@/db/schema";
import { ApiError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail/send";
import { noticeMail } from "@/lib/mail/templates";
import { notify } from "@/lib/notify";
import { ACTION_LABEL, URGENT_REASONS, type FlagTarget, type ModerationActionType } from "./labels";
import { loadTargetPreview } from "./preview";

export type StaffAction = Exclude<ModerationActionType, "kyc_approve" | "kyc_reject">;

export type ModerationInput = {
  action: StaffAction;
  reason: string;
  flagId?: string;
  userId?: string;
  days?: number;
  threadMode?: "lock" | "delete";
};

const SETTINGS_HREF = "/dashboard/einstellungen#moderation";

const USER_TITLE: Record<ModerationActionType, string> = {
  warn: "Du hast eine Verwarnung erhalten",
  remove_content: "Ein Inhalt von dir wurde entfernt",
  suspend_temp: "Dein Konto wurde vorübergehend gesperrt",
  suspend_perm: "Dein Konto wurde gesperrt",
  unsuspend: "Die Sperre deines Kontos wurde aufgehoben",
  kyc_approve: "Deine Verifikation wurde bestätigt",
  kyc_reject: "Deine Verifikation wurde abgelehnt",
  hide_profile: "Dein Profil wurde ausgeblendet",
  restore_profile: "Dein Profil ist wieder sichtbar",
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Begründung an die betroffene Person: In-App-Mitteilung und E-Mail (Mailfehler brechen die Aktion nicht ab). */
export async function informUser(userId: string, title: string, body: string, opts: { href?: string; mailExtra?: string } = {}) {
  const [u] = await db.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, userId));
  if (!u || u.status === "deleted") return;
  await notify(userId, { type: "moderation", title, body, href: opts.href ?? SETTINGS_HREF });
  const text = `${body}${opts.mailExtra ? `\n\n${opts.mailExtra}` : ""}`;
  const url = `${env.appUrl}${opts.href ?? SETTINGS_HREF}`;
  try {
    const mail = noticeMail(title, escapeHtml(text).replace(/\n/g, "<br>"), url);
    await sendMail(u.email, { ...mail, text: `${text}\n\n${url}` });
  } catch (err) {
    console.error("[moderation] Mail fehlgeschlagen", err);
  }
}

function assertCanModerate(staff: SessionUser, target: { id: string; role: string }) {
  if (target.id === staff.id) throw new ApiError("FORBIDDEN", "Du kannst keine Moderationsaktion gegen dich selbst ausführen");
  if (target.role !== "user" && staff.role !== "admin") throw new ApiError("FORBIDDEN", "Nur Admins können Team-Konten moderieren");
}

/** Inhalt entfernen je nach Zieltyp. Gibt eine Beschreibung für das Audit-Log zurück. */
async function removeContent(type: FlagTarget, id: string, threadMode: "lock" | "delete" = "lock") {
  const now = new Date();
  switch (type) {
    case "post":
      await db.update(posts).set({ deletedAt: now }).where(and(eq(posts.id, id), isNull(posts.deletedAt)));
      return "post.soft_delete";
    case "comment": {
      const [c] = await db.update(comments).set({ deletedAt: now }).where(and(eq(comments.id, id), isNull(comments.deletedAt))).returning({ postId: comments.postId });
      if (c) await db.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` }).where(eq(posts.id, c.postId));
      return "comment.soft_delete";
    }
    case "review":
      await db.update(reviews).set({ hidden: true }).where(eq(reviews.id, id));
      return "review.hidden";
    case "message":
      await db.update(messages).set({ deletedAt: now }).where(and(eq(messages.id, id), isNull(messages.deletedAt)));
      return "message.soft_delete";
    case "story": {
      const [s] = await db.delete(stories).where(eq(stories.id, id)).returning({ mediaId: stories.mediaId });
      if (s) await db.update(media).set({ status: "rejected" }).where(eq(media.id, s.mediaId));
      return "story.deleted";
    }
    case "media":
      await db.update(media).set({ status: "rejected" }).where(eq(media.id, id));
      return "media.rejected";
    case "thread":
      if (threadMode === "delete") {
        await db.delete(forumThreads).where(eq(forumThreads.id, id));
        return "thread.deleted";
      }
      await db.update(forumThreads).set({ locked: true }).where(eq(forumThreads.id, id));
      return "thread.locked";
    case "group":
      await db.delete(groups).where(eq(groups.id, id));
      return "group.deleted";
    case "profile":
      throw new ApiError("INVALID", "Für Profile bitte «Profil ausblenden» oder eine Sperre verwenden");
  }
}

/** Entfernen rückgängig machen (Einspruch angenommen). false, wenn nicht möglich (endgültig gelöscht). */
async function restoreContent(type: FlagTarget, id: string) {
  switch (type) {
    case "post":
      return (await db.update(posts).set({ deletedAt: null }).where(eq(posts.id, id)).returning({ id: posts.id })).length > 0;
    case "comment": {
      const [c] = await db.update(comments).set({ deletedAt: null }).where(eq(comments.id, id)).returning({ postId: comments.postId });
      if (c) await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, c.postId));
      return Boolean(c);
    }
    case "review":
      return (await db.update(reviews).set({ hidden: false }).where(eq(reviews.id, id)).returning({ id: reviews.id })).length > 0;
    case "message":
      return (await db.update(messages).set({ deletedAt: null }).where(eq(messages.id, id)).returning({ id: messages.id })).length > 0;
    case "media":
      return (await db.update(media).set({ status: "ready" }).where(eq(media.id, id)).returning({ id: media.id })).length > 0;
    case "thread":
      return (await db.update(forumThreads).set({ locked: false }).where(eq(forumThreads.id, id)).returning({ id: forumThreads.id })).length > 0;
    default:
      return false;
  }
}

/** Moderationsaktion ausführen: Wirkung, moderation_actions, Meldung schliessen, Audit, Begründung an User. */
export async function applyModeration(staff: SessionUser, input: ModerationInput) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new ApiError("INVALID", "Bitte gib eine Begründung an (mindestens 5 Zeichen)");
  const flag = input.flagId ? (await db.select().from(moderationFlags).where(eq(moderationFlags.id, input.flagId)))[0] : undefined;
  if (input.flagId && !flag) throw new ApiError("NOT_FOUND", "Meldung nicht gefunden");
  const preview = flag ? await loadTargetPreview(flag.targetType, flag.targetId) : null;
  const targetUserId = flag ? (flag.targetUserId ?? preview?.ownerId ?? null) : (input.userId ?? null);
  if (!targetUserId) throw new ApiError("INVALID", "Betroffene Person konnte nicht ermittelt werden");
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) throw new ApiError("NOT_FOUND", "Benutzer nicht gefunden");
  assertCanModerate(staff, target);

  let until: Date | null = null;
  let effect: string | null = null;
  switch (input.action) {
    case "warn":
      break;
    case "remove_content":
      if (!flag) throw new ApiError("INVALID", "Inhalte werden über eine Meldung entfernt");
      effect = await removeContent(flag.targetType, flag.targetId, input.threadMode);
      break;
    case "suspend_temp": {
      const days = Math.round(input.days ?? 0);
      if (days < 1 || days > 365) throw new ApiError("INVALID", "Sperrdauer 1–365 Tage");
      until = new Date(Date.now() + days * 86400_000);
      await db.update(users).set({ status: "suspended", suspendedUntil: until, updatedAt: new Date() }).where(eq(users.id, target.id));
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      break;
    }
    case "suspend_perm":
      await db.update(users).set({ status: "suspended", suspendedUntil: null, updatedAt: new Date() }).where(eq(users.id, target.id));
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      break;
    case "unsuspend":
      if (target.status !== "suspended") throw new ApiError("CONFLICT", "Das Konto ist nicht gesperrt");
      await db.update(users).set({ status: "active", suspendedUntil: null, updatedAt: new Date() }).where(eq(users.id, target.id));
      break;
    case "hide_profile":
      await db.update(users).set({ profileHidden: true, updatedAt: new Date() }).where(eq(users.id, target.id));
      break;
    case "restore_profile":
      await db.update(users).set({ profileHidden: false, updatedAt: new Date() }).where(eq(users.id, target.id));
      break;
  }

  const [row] = await db
    .insert(moderationActions)
    .values({ moderatorId: staff.id, targetUserId: target.id, flagId: flag?.id ?? null, action: input.action, reason, until })
    .returning({ id: moderationActions.id });

  if (flag) {
    const resolved = { status: "resolved" as const, resolvedBy: staff.id, resolution: `${ACTION_LABEL[input.action]}: ${reason}`, resolvedAt: new Date() };
    // Doppelte offene Meldungen zum gleichen Inhalt werden mit erledigt
    await db
      .update(moderationFlags)
      .set(resolved)
      .where(
        input.action === "remove_content"
          ? and(eq(moderationFlags.targetType, flag.targetType), eq(moderationFlags.targetId, flag.targetId), inArray(moderationFlags.status, ["open", "in_review"]))
          : eq(moderationFlags.id, flag.id),
      );
  }

  await audit(staff.id, `moderation.${input.action}`, { type: "user", id: target.id }, {
    actionId: row!.id,
    flagId: flag?.id,
    content: flag ? { type: flag.targetType, id: flag.targetId } : undefined,
    effect,
    reason,
    until: until?.toISOString(),
  });

  const extra =
    input.action === "suspend_temp" || input.action === "suspend_perm"
      ? "Während der Sperre kannst du dich nicht anmelden. Für einen Einspruch schreibe an support@poppsie.ch."
      : "Du kannst in deinen Kontoeinstellungen unter «Moderationsentscheide» Einspruch einlegen.";
  const body = until ? `${reason}\n\nGesperrt bis ${until.toLocaleString("de-CH", { timeZone: target.timezone || "Europe/Zurich" })}.` : reason;
  await informUser(target.id, USER_TITLE[input.action], body, { mailExtra: extra });
  return { actionId: row!.id };
}

/** Meldung verwerfen. Begründung geht an die meldende Person; optional vorläufig ausgeblendetes Profil wieder einblenden. */
export async function dismissFlag(staff: SessionUser, input: { flagId: string; reason: string; restoreProfile?: boolean }) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new ApiError("INVALID", "Bitte gib eine Begründung an (mindestens 5 Zeichen)");
  const [flag] = await db.select().from(moderationFlags).where(eq(moderationFlags.id, input.flagId));
  if (!flag) throw new ApiError("NOT_FOUND", "Meldung nicht gefunden");
  if (flag.status === "resolved" || flag.status === "dismissed") throw new ApiError("CONFLICT", "Die Meldung ist bereits abgeschlossen");
  await db
    .update(moderationFlags)
    .set({ status: "dismissed", resolvedBy: staff.id, resolution: reason, resolvedAt: new Date() })
    .where(eq(moderationFlags.id, flag.id));
  let restored = false;
  const ownerId = flag.targetUserId ?? (await loadTargetPreview(flag.targetType, flag.targetId)).ownerId;
  if (input.restoreProfile && ownerId) {
    const openUrgent = await db
      .select({ id: moderationFlags.id })
      .from(moderationFlags)
      .where(and(eq(moderationFlags.targetUserId, ownerId), inArray(moderationFlags.status, ["open", "in_review"]), inArray(moderationFlags.reason, ["minor", "coercion", "trafficking"])));
    const [owner] = await db.select({ hidden: users.profileHidden, del: users.deletionRequestedAt }).from(users).where(eq(users.id, ownerId));
    if (owner?.hidden && !owner.del && openUrgent.length === 0) {
      await db.update(users).set({ profileHidden: false }).where(eq(users.id, ownerId));
      restored = true;
    }
  }
  await audit(staff.id, "moderation.dismiss", { type: "flag", id: flag.id }, { reason, restoredProfile: restored, targetUserId: ownerId });
  if (flag.reporterId) {
    await notify(flag.reporterId, { type: "moderation", title: "Deine Meldung wurde geprüft", body: `Wir haben keinen Verstoss festgestellt. ${reason}` });
  }
  if (restored && ownerId) {
    await informUser(ownerId, USER_TITLE.restore_profile, "Eine Prüfung hat ergeben, dass kein Verstoss vorliegt. Dein Profil ist wieder sichtbar.");
  }
  return { restored, urgent: URGENT_REASONS.has(flag.reason) };
}

/** Einspruch angenommen: Wirkung der ursprünglichen Aktion zurücknehmen. */
export async function revertAction(actionId: string) {
  const [a] = await db.select().from(moderationActions).where(eq(moderationActions.id, actionId));
  if (!a) return { reverted: false, note: "Aktion nicht gefunden" };
  const flag = a.flagId ? (await db.select().from(moderationFlags).where(eq(moderationFlags.id, a.flagId)))[0] : undefined;
  switch (a.action) {
    case "suspend_temp":
    case "suspend_perm":
      await db.update(users).set({ status: "active", suspendedUntil: null }).where(and(eq(users.id, a.targetUserId), eq(users.status, "suspended")));
      return { reverted: true, note: "Sperre aufgehoben" };
    case "hide_profile":
      await db.update(users).set({ profileHidden: false }).where(eq(users.id, a.targetUserId));
      return { reverted: true, note: "Profil wieder sichtbar" };
    case "remove_content": {
      if (!flag) return { reverted: false, note: "Kein Inhalt verknüpft" };
      const ok = await restoreContent(flag.targetType, flag.targetId);
      return { reverted: ok, note: ok ? "Inhalt wiederhergestellt" : "Inhalt wurde endgültig gelöscht und kann nicht wiederhergestellt werden" };
    }
    case "kyc_reject":
      await db.update(users).set({ kycStatus: "pending" }).where(eq(users.id, a.targetUserId));
      return { reverted: true, note: "Verifikation wird erneut geprüft" };
    case "warn":
      return { reverted: true, note: "Verwarnung zurückgenommen" };
    default:
      return { reverted: false, note: "Nicht umkehrbar" };
  }
}
