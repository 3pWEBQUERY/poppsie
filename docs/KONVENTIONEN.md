# Konventionen

## Harte Regeln

- **Keine Verläufe, keine Schatten.** Keine `bg-gradient-*`, `linear-gradient`, `shadow-*`, `drop-shadow`, `box-shadow`, `text-shadow`. Schatten-Tokens sind in `globals.css` auf `none` gesetzt.
- **Keine Datei über 700 Zeilen.** Lieber in mehrere Komponenten/Module teilen.
- Prüfen mit `npm run check:rules`, `npm run typecheck`, `npm run lint`.

## Stack

- Next.js 16 (App Router), `params`/`searchParams` sind Promises, Typ-Helfer `PageProps<"/route">` und `RouteContext<"/route">` (nach `npx next typegen`).
- Eigener Server `server/index.ts` (Next + WebSocket `/ws` + Job-Worker). `npm run dev` startet ihn.
- Drizzle ORM (`src/db/schema/*`), Migrationen in `drizzle/` (`npm run db:generate`, `npm run db:migrate`).
- UI: shadcn-Komponenten in `src/components/ui`, geteilte Bausteine in `src/components/shared`.

## Server-Code

- Mutationen als Server Actions mit `run()` aus `@/lib/auth/guards`. Rückgabe ist `ActionResult<T>` (`{ ok, data }` oder `{ ok: false, code, status, error }`).
- Zugriff: `requireUser({ complete: true })` für alles, was bei unvollständigem Profil gesperrt ist (liefert `403 PROFILE_INCOMPLETE`). Frei bleiben Profil-Wizard, Kontoeinstellungen, Abmelden, Hilfe, Konto löschen.
- Gesperrte Dashboard-Seiten: `const { user, locked } = await dashboardPage(); if (locked) return <LockedNotice title="…" />;`
- Im Client: Fehler mit `useLockedHandler()` behandeln (öffnet den Profil-Hinweis bei `PROFILE_INCOMPLETE`).
- Rate-Limits auf schreibenden Endpunkten: `writeLimit(user.id, "aktion")` oder `limitOrThrow(key, limit, sekunden)`.
- Sichtbarkeit: `canViewProfile(viewer, target)` für Einzelprofile (sonst `notFound()`), `visibleToSql(spalte, viewerId, countries)` in Listen. `viewerCountries(viewer)` liefert die Länder des Betrachters.
- Profildaten kompakt: `getSummaries(ids, viewer)` → Name, Avatar-URL (Gäste sehen Blur-Varianten), Link. Inkognito: `anonymousSummary(avatarMediaId)`.
- Medien: Upload über `POST /api/upload` (Client: `uploadFile()` / `<MediaUploader>`). URLs immer mit `mediaUrl(id, "t" | "o" | "b")`; für Gäste bei aktivem Blur `variantFor(...)` nutzen.
- Echtzeit: `publish(userIds, event)` aus `@/lib/realtime/publish`; im Client auf `window`-Event `pp:realtime` hören.
- Benachrichtigungen: `notify(userId, { type, title, body, href })`.
- Statistik-Ereignisse: `track(profileId, type, { viewerId, source })`.
- Messaging-Kern (auch im Worker nutzbar): `getOrCreateConversation`, `insertMessage` in `@/lib/messaging/core`.
- Hintergrundjobs: `enqueue(type, payload, runAt)`; Handler in `server/jobs/*.ts`, registriert in `server/jobs/index.ts`. Code, der im Worker läuft, darf **nicht** `next/headers` verwenden.
- Audit-Log für Admin-Aktionen: `audit(actorId, action, target, meta)`.

## UI

- Auswahlfelder nur mit `Select`, `MultiSelect`, `MultiSelectWithLevel` aus `@/components/shared/select/select` (nie natives `<select>`).
- Bottom-Sheet: `@/components/ui/bottom-sheet` (`size="tall"` = 75 % Höhe).
- Emojis: `<EmojiPicker onSelect>`; gespeichert wird immer Unicode-Text.
- Avatare: `<UserAvatar user link ring="story" />`, Inkognito mit `anonymousSummary`.
- Profilkarten: `<ProfileCard p />`. Sterne: `<StarRating />`. Melden: `<ReportDialog />`. Favorit: `<FavoriteButton />`.
- Texte: Deutsch (Schweizer Schreibweise, „ss“ statt „ß“), Du-Form.

## Entwicklung

- Demo-Daten: `npx tsx scripts/seed-dev.ts` (Passwort `poppsie-demo-2026`; Benutzer z. B. `admin`, `max.muster`, `sophia.fire`, `palais_zh`).
- Session-Token für Tests: `npx tsx scripts/dev-session.ts <benutzername>` → Cookie `pp_session=<token>` (und `pp_age=1`).
