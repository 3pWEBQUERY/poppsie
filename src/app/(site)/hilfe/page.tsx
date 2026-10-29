import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown, LifeBuoy, Mail, ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Hilfe & FAQ", description: "Antworten auf häufige Fragen zu Konto, Profil, Verifikation, Buchungen, Sicherheit und Datenschutz." };

type Faq = { q: string; a: React.ReactNode };

const GROUPS: { id: string; title: string; items: Faq[] }[] = [
  {
    id: "konto",
    title: "Konto & Anmeldung",
    items: [
      { q: "Wer darf sich anmelden?", a: "Nur Erwachsene ab 18 Jahren. Du wählst bei der Registrierung, ob du Mitglied, Escort oder Club/Studio bist." },
      { q: "Ich habe keinen Aktivierungscode erhalten.", a: "Prüfe den Spam-Ordner. Der Code ist 15 Minuten gültig; du kannst im Registrierungsschritt einen neuen anfordern." },
      {
        q: "Wie ändere ich E-Mail oder Passwort?",
        a: (
          <>
            In den <Link href="/dashboard/einstellungen#anmeldung">Kontoeinstellungen</Link>. Für beides brauchst du dein aktuelles Passwort. Andere Geräte
            werden nach einer Passwortänderung abgemeldet.
          </>
        ),
      },
      {
        q: "Wie richte ich die Zwei-Faktor-Anmeldung ein?",
        a: (
          <>
            Unter <Link href="/dashboard/einstellungen#zwei-faktor">Zwei-Faktor</Link> erhältst du einen Schlüssel für eine Authenticator-App. Nach der Bestätigung
            mit einem Code fragt der Login immer nach dem 6-stelligen Code.
          </>
        ),
      },
      { q: "Warum werde ich nach dem Login noch gesperrt?", a: "Solange dein Profil nicht vollständig ist, sind einige Bereiche gesperrt. Der Profil-Assistent zeigt dir, was noch fehlt." },
    ],
  },
  {
    id: "profil",
    title: "Profil & Verifikation",
    items: [
      { q: "Warum ist mein Escort- oder Club-Profil noch nicht sichtbar?", a: "Öffentlich wird es erst nach der Identitäts- und Altersverifikation. Den Status siehst du im Dashboard unter «Verifikation»." },
      { q: "Was ist die Foto-Verifikation?", a: "Ein Selfie mit einer vorgegebenen Code-Geste. Damit bestätigen wir, dass deine Fotos wirklich dich zeigen." },
      { q: "Können Gäste meine Fotos sehen?", a: "Nur, wenn du es erlaubst. Mit «Blur für Gäste» sehen nicht angemeldete Besucher ausschliesslich unscharfe Varianten." },
      { q: "Kann ich mein Profil in bestimmten Ländern verbergen?", a: "Ja, unter «Sichtbarkeit & Privatsphäre» sperrst du Länder. Besucher aus diesen Ländern finden dein Profil nirgends." },
    ],
  },
  {
    id: "kontakt",
    title: "Nachrichten, Buchungen & Berichte",
    items: [
      { q: "Was bedeutet «Connect»?", a: "Escorts entscheiden, ob Mitglieder ihnen ohne Buchungsanfrage schreiben dürfen. Ist Connect aus, ist der Kontakt nur über eine Buchungsanfrage möglich." },
      { q: "Wie funktioniert eine Buchung?", a: "Du wählst einen freien Termin im Kalender und sendest eine Anfrage. Die Escort bestätigt, lehnt ab oder schlägt eine andere Zeit vor." },
      { q: "Wer darf Berichte schreiben?", a: "Mitglieder über Escorts und Clubs. Berichte mit bestätigter Buchung werden als verifiziert markiert. Die bewertete Person kann einmal öffentlich antworten." },
    ],
  },
  {
    id: "sicherheit",
    title: "Sicherheit & Moderation",
    items: [
      {
        q: "Wie melde ich einen Inhalt?",
        a: (
          <>
            Über «Melden» direkt am Profil, Beitrag, Kommentar, Bericht, an der Nachricht oder Story. Mehr dazu unter <Link href="/sicherheit#melden">Sicherheit</Link>.
          </>
        ),
      },
      {
        q: "Was passiert bei Verdacht auf Minderjährigkeit, Zwang oder Menschenhandel?",
        a: "Solche Meldungen werden mit höchster Priorität geprüft und das Profil wird sofort vorläufig ausgeblendet. In akuten Fällen ruf direkt die Polizei unter 117.",
      },
      { q: "Wie blockiere ich jemanden?", a: "Über das Menü am Profil oder im Chat. Blockierte Personen sehen dich nirgends mehr – und du sie nicht." },
      {
        q: "Ich wurde verwarnt oder gesperrt. Was kann ich tun?",
        a: (
          <>
            Die Begründung findest du unter <Link href="/dashboard/einstellungen#moderation">Moderationsentscheide</Link>. Dort kannst du innerhalb von 90 Tagen
            Einspruch erheben. Bei einer Sperre schreibst du an <a href="mailto:support@poppsie.ch">support@poppsie.ch</a>.
          </>
        ),
      },
    ],
  },
  {
    id: "daten",
    title: "Datenschutz & Löschung",
    items: [
      {
        q: "Kann ich meine Daten herunterladen?",
        a: (
          <>
            Ja, als JSON-Datei unter <Link href="/dashboard/einstellungen#export">Datenexport</Link> – Konto, Profil, Medienliste, Beiträge, Nachrichten, Berichte,
            Buchungen und mehr.
          </>
        ),
      },
      {
        q: "Wie lösche ich mein Konto?",
        a: (
          <>
            Unter <Link href="/dashboard/einstellungen#loeschen">Konto löschen</Link> mit deinem Passwort. Dein Profil verschwindet sofort, nach 30 Tagen sind alle
            persönlichen Daten entfernt. Meldest du dich vorher wieder an, wird die Löschung abgebrochen.
          </>
        ),
      },
      { q: "Was passiert mit meinen Berichten nach der Löschung?", a: "Sie bleiben anonymisiert («gelöschtes Mitglied») erhalten, damit die Bewertungen anderer Profile aussagekräftig bleiben." },
      { q: "Sehen andere, dass ich ihr Profil besucht habe?", a: "Ja, im Besucherbereich. Mit Inkognito erscheinst du nur mit Milchglas-Avatar, ohne Namen und ohne Link." },
    ],
  },
];

export default function HilfePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <LifeBuoy className="size-7 text-primary" /> Hilfe & FAQ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Schnelle Antworten auf die häufigsten Fragen.</p>
        <nav aria-label="Themen" className="mt-4 flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              {g.title}
            </a>
          ))}
        </nav>
      </header>
      <div className="flex flex-col gap-8">
        {GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-24">
            <h2 className="mb-3 text-lg font-bold">{g.title}</h2>
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              {g.items.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline">{f.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <a href="mailto:support@poppsie.ch" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-foreground/40">
          <Mail className="mt-0.5 size-5 text-primary" />
          <span className="text-sm">
            <span className="block font-semibold">Keine Antwort gefunden?</span>
            <span className="text-muted-foreground">Schreib uns an support@poppsie.ch</span>
          </span>
        </a>
        <Link href="/sicherheit" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-foreground/40">
          <ShieldAlert className="mt-0.5 size-5 text-primary" />
          <span className="text-sm">
            <span className="block font-semibold">Sicherheit & Notfall</span>
            <span className="text-muted-foreground">Notfallnummern, Melden, Hilfsangebote</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
