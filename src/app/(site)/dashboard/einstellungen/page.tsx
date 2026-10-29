import type { Metadata } from "next";
import { cookies } from "next/headers";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { appeals, moderationActions, sessions } from "@/db/schema";
import { EmailForm, PasswordForm } from "@/components/account/credentials-forms";
import { DataExport, DeleteAccount } from "@/components/account/delete-account";
import { ModerationDecisions, type Decision } from "@/components/account/moderation-decisions";
import { PreferencesForm } from "@/components/account/preferences-form";
import { SettingsSection } from "@/components/account/section";
import { SessionsList } from "@/components/account/sessions-list";
import { TotpSection } from "@/components/account/totp-section";
import { sha256 } from "@/lib/auth/crypto";
import { requirePageUser } from "@/lib/auth/guards";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Kontoeinstellungen" };

const NAV = [
  ["anmeldung", "Anmeldung"],
  ["sprache", "Sprache & Zeitzone"],
  ["zwei-faktor", "Zwei-Faktor"],
  ["sitzungen", "Sitzungen"],
  ["moderation", "Moderationsentscheide"],
  ["export", "Datenexport"],
  ["loeschen", "Konto löschen"],
] as const;

const appealWindowOver = (d: Date) => Date.now() - d.getTime() > 90 * 86400_000;

/** Kontoeinstellungen: auch mit unvollständigem Profil frei zugänglich. */
export default async function SettingsPage() {
  const user = await requirePageUser({ next: "/dashboard/einstellungen" });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentId = token ? sha256(token) : null;
  const [sess, actions] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt)),
    db
      .select({ action: moderationActions, appealStatus: appeals.status, appealAt: appeals.createdAt })
      .from(moderationActions)
      .leftJoin(appeals, eq(appeals.actionId, moderationActions.id))
      .where(eq(moderationActions.targetUserId, user.id))
      .orderBy(desc(moderationActions.createdAt))
      .limit(50),
  ]);
  const decisions: Decision[] = actions.map(({ action: a, appealStatus, appealAt }) => ({
    id: a.id,
    action: a.action,
    reason: a.reason,
    until: a.until?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    appeal: appealStatus && appealAt ? { status: appealStatus, createdAt: appealAt.toISOString() } : null,
    expired: appealWindowOver(a.createdAt),
  }));
  const sessionRows = sess
    .map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Kontoeinstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anmeldung, Sicherheit, Sprache und deine Daten.</p>
        <nav aria-label="Abschnitte" className="mt-3 flex flex-wrap gap-1.5">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </div>
      <SettingsSection id="anmeldung" title="E-Mail & Passwort" description={`Benutzername: @${user.username} (nicht änderbar)`}>
        <div className="flex flex-col gap-6">
          <EmailForm email={user.email} />
          <div className="border-t pt-5">
            <h3 className="mb-3 text-sm font-bold">Passwort ändern</h3>
            <PasswordForm userInputs={[user.username, user.email]} />
          </div>
        </div>
      </SettingsSection>
      <SettingsSection id="sprache" title="Sprache & Zeitzone">
        <PreferencesForm locale={user.locale} timezone={user.timezone} />
      </SettingsSection>
      <SettingsSection id="zwei-faktor" title="Zwei-Faktor-Anmeldung (2FA)" description="Optional, aber empfohlen – besonders für Escorts und Clubs.">
        <TotpSection enabled={Boolean(user.totpSecret)} />
      </SettingsSection>
      <SettingsSection id="sitzungen" title="Aktive Sitzungen" description="Geräte, auf denen du angemeldet bist. Unbekanntes Gerät? Abmelden und Passwort ändern.">
        <SessionsList sessions={sessionRows} />
      </SettingsSection>
      <SettingsSection id="moderation" title="Moderationsentscheide" description="Verwarnungen, Sperren und entfernte Inhalte mit Begründung. Gegen Entscheide kannst du innerhalb von 90 Tagen Einspruch erheben.">
        <ModerationDecisions decisions={decisions} />
      </SettingsSection>
      <SettingsSection id="export" title="Deine Daten">
        <DataExport />
      </SettingsSection>
      <SettingsSection id="loeschen" title="Konto löschen" tone="danger">
        <DeleteAccount pending={Boolean(user.deletionRequestedAt)} />
      </SettingsSection>
    </div>
  );
}
