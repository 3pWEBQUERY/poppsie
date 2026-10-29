# Poppsie – Escort Community Plattform (18+)

Community für Erwachsene in der Schweiz: Mitglieder, Escorts sowie Clubs und Studios mit Profilen, Suche, Messenger, Buchung im Chat, Berichten, Stories, Newsfeed, Forum und Gruppen. Grundlage ist die PRD „Escort Community Plattform“.

## Stack

| Bereich | Technik |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn-Komponenten auf Radix, lucide-Icons, **keine Verläufe, keine Schatten** |
| Datenbank | Railway Postgres, Drizzle ORM, Migrationen in `drizzle/` |
| Medien | Railway Bucket (S3-kompatibel, privat), sharp für EXIF-Entfernung, Thumbnails und Blur-Varianten |
| Echtzeit | WebSockets (`ws`) im eigenen Server `server/index.ts`, Verteilung über Postgres `LISTEN/NOTIFY` |
| Jobs | Postgres-Queue mit `FOR UPDATE SKIP LOCKED` (Planer, Erinnerungen, Broadcasts, Aggregation, Löschfristen) |
| E-Mail | Resend (Aktivierungscodes in DE/FR/IT/EN) |
| Sicherheit | Argon2id, HttpOnly-Session-Cookies, HIBP k-Anonymity, zxcvbn, Rate-Limits, Turnstile (optional), TOTP |

## Lokal starten

```bash
cp .env.example .env.local      # DATABASE_URL usw. anpassen
npm install
npm run db:migrate
npx tsx scripts/seed-dev.ts     # Demo-Daten, Passwort: poppsie-demo-2026
npm run dev                     # http://localhost:3000
```

Ohne `RESEND_API_KEY` werden Aktivierungscodes im Server-Log ausgegeben, ohne Bucket-Variablen landen Uploads in `.uploads/`.

## Prüfen

```bash
npm run typecheck
npm run lint
npm run check:rules   # keine Datei > 700 Zeilen, keine Verläufe, keine Schatten
```

## Deployment auf Railway

Projekt **Poppsie** (Region Europa / Amsterdam) mit drei Ressourcen:

- `Postgres` (Railway-Template, Postgres 18)
- `poppsie-media` (Railway Bucket)
- `poppsie` (diese App, aus GitHub)

`railway.json` legt Build (`npm run build`), Start (`npm start` → `tsx server/index.ts`), Migrationen vor jedem Deploy (`npm run db:migrate`) und den Healthcheck (`/api/health`) fest.

Variablen des App-Service (Referenzen statt kopierter Werte):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
BUCKET=${{poppsie-media.BUCKET}}
ENDPOINT=${{poppsie-media.ENDPOINT}}
REGION=${{poppsie-media.REGION}}
ACCESS_KEY_ID=${{poppsie-media.ACCESS_KEY_ID}}
SECRET_ACCESS_KEY=${{poppsie-media.SECRET_ACCESS_KEY}}
APP_URL=https://<domain>
APP_SECRET=<zufällig, mind. 32 Zeichen>
RESEND_API_KEY=<von resend.com>
MAIL_FROM="Poppsie <noreply@deine-domain.ch>"
ADMIN_USERNAME=<dein Benutzername>
TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY (optional)
```

## Struktur

```
server/              Eigener Server: Next.js + WebSocket + Job-Worker
  jobs/              Job-Handler und periodische Aufgaben je Modul
src/app/(site)/      Öffentliche Seiten, Dashboard, Admin
src/app/(auth)/      Registrierung (5-Schritt-Wizard), Login, Passwort-Reset
src/app/api/         Upload, geschützte Medienauslieferung, Export, Health
src/components/ui/   shadcn-Komponenten
src/components/shared/  Select, Emoji-Picker, Medien-Uploader, Avatar, Profilkarte …
src/db/schema/       Drizzle-Schema (alle Entitäten der PRD)
src/lib/             Auth, Sichtbarkeit, Medien, Mail, Echtzeit, Suche …
docs/KONVENTIONEN.md Regeln und Hilfsfunktionen für die Entwicklung
```

## Offene Punkte aus der PRD

- Juristische Prüfung (AGB, Impressum, kantonale Werbevorschriften, Bewilligungsnummern).
- KYC-Anbieter: Der Ablauf ist anbieterneutral vorbereitet, Freigaben erfolgen derzeit manuell im Admin-Bereich.
- Emojis: native Plattform-Emojis (Apple-Set ist nicht lizenzierbar).
- Geo-IP: Länder-Sperren nutzen `CF-IPCountry`. Dafür muss die Domain über Cloudflare laufen. Zusätzlich gilt immer das Land eingeloggter User.
- Zahlungen, Monetarisierung, iOS-App: Phase 5.
