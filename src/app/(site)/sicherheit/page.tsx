import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Camera, Flag, Phone, ShieldAlert } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Sicherheit & Jugendschutz", description: "Verifikation, Meldesystem, Notfallnummern und Hilfsangebote." };

const EMERGENCY = [
  { number: "117", label: "Polizei", note: "akute Gefahr, Gewalt, Verdacht auf Menschenhandel" },
  { number: "144", label: "Sanität", note: "medizinischer Notfall" },
  { number: "143", label: "Die Dargebotene Hand", note: "Gespräch rund um die Uhr, anonym" },
  { number: "147", label: "Pro Juventute", note: "für Kinder und Jugendliche" },
];

const HELP = [
  { name: "ACT212 – Beratungs- und Meldestelle Menschenhandel", contact: "0840 212 212 · act212.ch" },
  { name: "FIZ Fachstelle Frauenhandel und Frauenmigration", contact: "fiz-info.ch" },
  { name: "Opferhilfe Schweiz (Beratungsstellen in allen Kantonen)", contact: "opferhilfe-schweiz.ch" },
  { name: "ProCoRe – Netzwerk für die Rechte von Sexarbeitenden", contact: "procore-info.ch" },
];

export default function SicherheitPage() {
  return (
    <LegalPage
      title="Sicherheit & Jugendschutz"
      draft
      toc={[
        { id: "notfall", label: "Notfall" },
        { id: "verifikation", label: "Verifikation" },
        { id: "melden", label: "Inhalte melden" },
        { id: "hilfe", label: "Hilfsangebote" },
        { id: "tipps", label: "Sicher treffen" },
      ]}
      intro="Poppsie ist nur für Erwachsene. Wir prüfen Alter und Identität von Anbieterinnen, bearbeiten Meldungen priorisiert und arbeiten mit Behörden zusammen, wenn Menschen in Gefahr sind."
    >
      <section id="notfall" className="scroll-mt-24 rounded-lg border border-primary/50 bg-primary/10 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Phone className="size-5 text-primary" /> Im Notfall
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EMERGENCY.map((e) => (
            <li key={e.number}>
              <a href={`tel:${e.number}`} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:border-foreground/40">
                <span className="font-display text-2xl font-extrabold text-primary">{e.number}</span>
                <span className="text-sm">
                  <span className="block font-semibold">{e.label}</span>
                  <span className="block text-xs text-muted-foreground">{e.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Rufe bei unmittelbarer Gefahr immer zuerst die Polizei. Eine Meldung bei Poppsie ersetzt keinen Notruf.</p>
      </section>

      <LegalSection id="verifikation" title="Verifikation">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <BadgeCheck className="size-4 text-primary" /> Identität & Alter (KYC)
            </p>
            <p className="text-muted-foreground">
              Escorts und Betreiber von Clubs und Studios weisen sich vor der Freischaltung mit Ausweis und Selfie-Abgleich über einen spezialisierten Anbieter
              aus. Das Mindestalter von 18 Jahren wird hart geprüft. Ausweisdaten speichert Poppsie nicht selbst. Verifizierte Profile tragen das Verifiziert-Badge.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Camera className="size-4 text-primary" /> Foto-Verifikation
            </p>
            <p className="text-muted-foreground">
              Damit die Fotos zum Profil passen, nehmen Anbieterinnen ein Selfie mit einer vorgegebenen Code-Geste auf. Unser Team vergleicht es mit den
              Profilfotos. Uploads werden zusätzlich automatisch geprüft; Hinweise gehen an die Moderation.
            </p>
          </div>
        </div>
        <p>
          Du bist Anbieterin? Die Verifikation startest du im Dashboard unter <Link href="/dashboard/verifikation">Verifikation</Link>.
        </p>
      </LegalSection>

      <LegalSection id="melden" title="Inhalte melden">
        <p>
          Profile, Beiträge, Kommentare, Berichte, Nachrichten, Stories, Gruppen, Forum-Threads und Medien kannst du über <Flag className="inline size-3.5" />{" "}
          <strong>Melden</strong> direkt am Inhalt melden. Wähle einen Grund und beschreibe kurz, was dir aufgefallen ist.
        </p>
        <div className="flex items-start gap-3 rounded-lg border border-primary/50 bg-card p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Verdacht auf Minderjährigkeit, Zwang oder Menschenhandel</p>
            <p className="text-muted-foreground">
              Diese Meldungen haben höchste Priorität: Sie stehen in der Moderation ganz oben, das betroffene Profil wird sofort vorläufig ausgeblendet und das
              Team wird umgehend benachrichtigt. Bei konkreten Hinweisen informieren wir die Polizei.
            </p>
          </div>
        </div>
        <ol>
          <li>Deine Meldung ist vertraulich; die gemeldete Person erfährt nicht, wer gemeldet hat.</li>
          <li>Das Team prüft den Inhalt und entscheidet: Verwarnung, Entfernen, Ausblenden, temporäre oder permanente Sperre – oder kein Verstoss.</li>
          <li>Betroffene erhalten immer eine Begründung und können innerhalb von 90 Tagen Einspruch erheben.</li>
          <li>Wer meldet, wird über das Ergebnis informiert.</li>
        </ol>
        <p>
          Wer dich belästigt, kannst du zusätzlich blockieren: Ihr seht euch danach gegenseitig nirgends mehr – weder in der Suche, im Feed, bei den Besuchern noch
          im Chat.
        </p>
      </LegalSection>

      <LegalSection id="hilfe" title="Hilfsangebote">
        <p>Kostenlose und vertrauliche Beratung, auch ohne Anzeige bei der Polizei:</p>
        <ul className="!ml-0 !list-none grid gap-2 sm:grid-cols-2">
          {HELP.map((h) => (
            <li key={h.name} className="!ml-0 rounded-md border bg-card px-3 py-2">
              <span className="block font-semibold">{h.name}</span>
              <span className="block text-xs text-muted-foreground">{h.contact}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Kantonale Fachstellen für Sexarbeit bieten zudem Gesundheits-, Rechts- und Sozialberatung an.</p>
      </LegalSection>

      <LegalSection id="tipps" title="Sicher treffen">
        <ul>
          <li>Bleib bei der Kommunikation auf Poppsie, bis ihr euch vertraut – gib Telefonnummer und Adresse erst spät weiter.</li>
          <li>Achte auf das Verifiziert-Badge und echte Berichte mit Buchungsbestätigung.</li>
          <li>Leiste keine Vorauszahlungen an Unbekannte; Poppsie fragt nie nach Passwörtern oder Zahlungsdaten per Nachricht.</li>
          <li>Informiere eine Vertrauensperson über Ort und Zeit eines Treffens.</li>
          <li>Respektiere Grenzen: Ein Nein gilt – jederzeit.</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
