import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { appeals, auditLog, clubProfiles, escortProfiles, kycVerifications, media, moderationActions, moderationFlags, sessions, users } from "@/db/schema";
import { mediaUrl } from "@/lib/media/urls";
import { FLAG_REASONS, FLAG_STATUSES, FLAG_TARGETS, type FlagReason, type FlagStatus, type FlagTarget } from "./labels";

export const PAGE_SIZE = 30;

const reporter = alias(users, "reporter");
const targetUser = alias(users, "target_user");
const moderator = alias(users, "moderator");

export type QueueFilter = { status?: string; reason?: string; target?: string; page?: number };

const pick = <T extends string>(v: string | undefined, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseQueueFilter(sp: Record<string, string | string[] | undefined>): Required<Omit<QueueFilter, "status">> & { status: FlagStatus | "active" | "all" } {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = s("status") === "all" ? "all" : (pick(s("status"), FLAG_STATUSES) ?? "active");
  return {
    status,
    reason: pick(s("grund"), FLAG_REASONS) ?? "",
    target: pick(s("typ"), FLAG_TARGETS) ?? "",
    page: Math.max(1, Number(s("seite")) || 1),
  };
}

/** Warteschlange: Priorität absteigend (dringende Kategorien = 100 zuerst), dann älteste zuerst. */
export async function listFlags(f: ReturnType<typeof parseQueueFilter>) {
  const where: SQL[] = [];
  if (f.status === "active") where.push(inArray(moderationFlags.status, ["open", "in_review"]));
  else if (f.status !== "all") where.push(eq(moderationFlags.status, f.status));
  if (f.reason) where.push(eq(moderationFlags.reason, f.reason as FlagReason));
  if (f.target) where.push(eq(moderationFlags.targetType, f.target as FlagTarget));
  const cond = where.length ? and(...where) : undefined;
  const rows = await db
    .select({
      flag: moderationFlags,
      reporter: reporter.username,
      target: targetUser.username,
      targetHidden: targetUser.profileHidden,
    })
    .from(moderationFlags)
    .leftJoin(reporter, eq(reporter.id, moderationFlags.reporterId))
    .leftJoin(targetUser, eq(targetUser.id, moderationFlags.targetUserId))
    .where(cond)
    .orderBy(desc(moderationFlags.priority), asc(moderationFlags.createdAt))
    .limit(PAGE_SIZE)
    .offset((f.page - 1) * PAGE_SIZE);
  const [total] = await db.select({ n: count() }).from(moderationFlags).where(cond);
  return { rows, total: total?.n ?? 0 };
}

export async function openCounts() {
  const [flags] = await db
    .select({ n: count(), urgent: sql<number>`count(*) filter (where ${moderationFlags.priority} >= 100)`.mapWith(Number) })
    .from(moderationFlags)
    .where(inArray(moderationFlags.status, ["open", "in_review"]));
  const [ap] = await db.select({ n: count() }).from(appeals).where(eq(appeals.status, "open"));
  const [kyc] = await db.select({ n: count() }).from(users).where(and(eq(users.kycStatus, "pending"), inArray(users.accountType, ["escort", "club"])));
  return { flags: flags?.n ?? 0, urgent: flags?.urgent ?? 0, appeals: ap?.n ?? 0, kyc: kyc?.n ?? 0 };
}

export async function getFlag(id: string) {
  const [row] = await db
    .select({ flag: moderationFlags, reporter: reporter.username, reporterId: reporter.id, resolver: moderator.username })
    .from(moderationFlags)
    .leftJoin(reporter, eq(reporter.id, moderationFlags.reporterId))
    .leftJoin(moderator, eq(moderator.id, moderationFlags.resolvedBy))
    .where(eq(moderationFlags.id, id));
  return row ?? null;
}

/** Bisherige Moderationsaktionen gegen eine Person, neueste zuerst. */
export async function actionsAgainst(userId: string, limit = 50) {
  return db
    .select({ action: moderationActions, moderator: moderator.username, appealStatus: appeals.status, appealId: appeals.id })
    .from(moderationActions)
    .leftJoin(moderator, eq(moderator.id, moderationActions.moderatorId))
    .leftJoin(appeals, eq(appeals.actionId, moderationActions.id))
    .where(eq(moderationActions.targetUserId, userId))
    .orderBy(desc(moderationActions.createdAt))
    .limit(limit);
}

export async function flagsAbout(userId: string, limit = 50) {
  return db
    .select({ flag: moderationFlags, reporter: reporter.username })
    .from(moderationFlags)
    .leftJoin(reporter, eq(reporter.id, moderationFlags.reporterId))
    .where(eq(moderationFlags.targetUserId, userId))
    .orderBy(desc(moderationFlags.createdAt))
    .limit(limit);
}

export async function flagsOnTarget(type: FlagTarget, id: string) {
  return db
    .select({ flag: moderationFlags, reporter: reporter.username })
    .from(moderationFlags)
    .leftJoin(reporter, eq(reporter.id, moderationFlags.reporterId))
    .where(and(eq(moderationFlags.targetType, type), eq(moderationFlags.targetId, id)))
    .orderBy(desc(moderationFlags.createdAt));
}

export async function flagsBy(userId: string, limit = 20) {
  return db.select().from(moderationFlags).where(eq(moderationFlags.reporterId, userId)).orderBy(desc(moderationFlags.createdAt)).limit(limit);
}

export async function listAppeals(status: "open" | "accepted" | "rejected" | "all") {
  return db
    .select({
      appeal: appeals,
      action: moderationActions,
      user: users.username,
      userStatus: users.status,
      moderator: moderator.username,
    })
    .from(appeals)
    .innerJoin(moderationActions, eq(moderationActions.id, appeals.actionId))
    .innerJoin(users, eq(users.id, appeals.userId))
    .leftJoin(moderator, eq(moderator.id, moderationActions.moderatorId))
    .where(status === "all" ? undefined : eq(appeals.status, status))
    .orderBy(status === "open" ? asc(appeals.createdAt) : desc(appeals.createdAt))
    .limit(100);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** KYC-Warteschlange: Escorts und Clubs mit kycStatus = pending und ihre Nachweise. */
export async function kycQueue() {
  const people = await db
    .select({ user: users, birthDate: escortProfiles.birthDate, displayName: escortProfiles.displayName, clubName: clubProfiles.name })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(and(eq(users.kycStatus, "pending"), inArray(users.accountType, ["escort", "club"])))
    .orderBy(asc(users.updatedAt))
    .limit(50);
  const ids = people.map((p) => p.user.id);
  const checks = ids.length ? await db.select().from(kycVerifications).where(inArray(kycVerifications.userId, ids)).orderBy(desc(kycVerifications.createdAt)) : [];
  // Selfie bzw. Nachweis: provider_ref enthält bei manueller Prüfung die Medien-ID
  const mediaIds = checks.map((c) => c.providerRef).filter((r): r is string => Boolean(r && UUID_RE.test(r)));
  const mediaRows = mediaIds.length ? await db.select({ id: media.id, kind: media.kind, ownerId: media.ownerId }).from(media).where(inArray(media.id, mediaIds)) : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));
  const avatars = new Map(people.filter((p) => p.user.avatarMediaId).map((p) => [p.user.id, mediaUrl(p.user.avatarMediaId!, "t", 1800)]));
  return people.map((p) => ({
    ...p,
    avatarUrl: avatars.get(p.user.id) ?? null,
    checks: checks
      .filter((c) => c.userId === p.user.id)
      .map((c) => {
        const m = c.providerRef ? mediaMap.get(c.providerRef) : undefined;
        return { ...c, media: m && m.ownerId === p.user.id ? { id: m.id, kind: m.kind, url: mediaUrl(m.id, "o", 1800) } : null };
      }),
  }));
}

export async function searchUsers(q: string, page = 1) {
  const term = q.trim();
  const cond = term ? or(ilike(users.username, `%${term}%`), ilike(users.email, `%${term}%`)) : undefined;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      accountType: users.accountType,
      role: users.role,
      status: users.status,
      kycStatus: users.kycStatus,
      profileHidden: users.profileHidden,
      deletionRequestedAt: users.deletionRequestedAt,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(cond)
    .orderBy(term ? asc(users.username) : desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const [total] = await db.select({ n: count() }).from(users).where(cond);
  return { rows, total: total?.n ?? 0 };
}

export async function userDetail(id: string) {
  const [row] = await db
    .select({ user: users, birthDate: escortProfiles.birthDate, displayName: escortProfiles.displayName, clubName: clubProfiles.name, clubSlug: clubProfiles.slug })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(eq(users.id, id));
  if (!row) return null;
  const [sess] = await db.select({ n: count() }).from(sessions).where(eq(sessions.userId, id));
  const kyc = await db.select().from(kycVerifications).where(eq(kycVerifications.userId, id)).orderBy(desc(kycVerifications.createdAt));
  return { ...row, sessionCount: sess?.n ?? 0, kyc };
}

export type AuditFilter = { action: string; actor: string; target: string; page: number };

export function parseAuditFilter(sp: Record<string, string | string[] | undefined>): AuditFilter {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : "");
  return { action: s("aktion"), actor: s("akteur"), target: s("ziel"), page: Math.max(1, Number(s("seite")) || 1) };
}

export async function listAudit(f: AuditFilter) {
  const where: SQL[] = [];
  if (f.action) where.push(ilike(auditLog.action, `${f.action}%`));
  if (f.actor) where.push(ilike(moderator.username, `%${f.actor}%`));
  if (f.target) where.push(or(eq(auditLog.targetId, f.target), ilike(targetUser.username, `%${f.target}%`))!);
  const cond = where.length ? and(...where) : undefined;
  const base = db
    .select({ log: auditLog, actor: moderator.username, target: targetUser.username })
    .from(auditLog)
    .leftJoin(moderator, sql`${moderator.id} = ${auditLog.actorId}`)
    .leftJoin(targetUser, sql`${auditLog.targetType} = 'user' and ${targetUser.id}::text = ${auditLog.targetId}`)
    .where(cond);
  const rows = await base
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE_SIZE)
    .offset((f.page - 1) * PAGE_SIZE);
  const [total] = await db
    .select({ n: count() })
    .from(auditLog)
    .leftJoin(moderator, sql`${moderator.id} = ${auditLog.actorId}`)
    .leftJoin(targetUser, sql`${auditLog.targetType} = 'user' and ${targetUser.id}::text = ${auditLog.targetId}`)
    .where(cond);
  return { rows, total: total?.n ?? 0 };
}

export async function auditActionPrefixes() {
  const rows = await db.execute<{ p: string }>(sql`select distinct split_part(action, '.', 1) as p from audit_log order by 1 limit 50`);
  return rows.rows.map((r) => r.p).filter(Boolean);
}
