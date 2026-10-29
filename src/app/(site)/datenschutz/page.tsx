import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalSection, Placeholder } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Datenschutz", description: "Datenschutzerklärung nach revDSG und DSGVO." };

const TOC = [
  { id: "verantwortlich", label: "Verantwortliche Stelle" },
  { id: "daten", label: "Welche Daten wir bearbeiten" },
  { id: "zwecke", label: "Zwecke & Rechtsgrundlagen" },
  { id: "sensibel", label: "Besonders schützenswerte Daten" },
  { id: "hosting", label: "Hosting & Empfänger" },
  { id: "cookies", label: "Cookies" },
  { id: "dauer", label: "Speicherdauer & Löschung" },
  { id: "rechte", label: "Deine Rechte" },
  { id: "sicherheit", label: "Datensicherheit" },
  { id: "aenderungen", label: "Änderungen" },
];

export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      updated="29. Oktober 2026"
      toc={TOC}
      intro="Diskretion ist der Kern von Poppsie. Wir bearbeiten so wenige Daten wie möglich – nach dem Schweizer Datenschutzgesetz (revDSG) und, für Personen in der EU/im EWR, nach der DSGVO."
    >
      <LegalSection id="verantwortlich" title="1. Verantwortliche Stelle">
        <p>
          <Placeholder>Firmenname GmbH</Placeholder>, <Placeholder>Adresse</Placeholder>, Schweiz · <a href="mailto:datenschutz@poppsie.ch">datenschutz@poppsie.ch</a>
        </p>
        <p>
          Vertretung in der EU (Art. 27 DSGVO): <Placeholder>Name und Adresse der EU-Vertretung</Placeholder>
        </p>
      </LegalSection>
      <LegalSection id="daten" title="2. Welche Daten wir bearbeiten">
        <ul>
          <li><strong>Konto:</strong> Benutzername, E-Mail, Passwort (nur als Argon2id-Hash), Kontotyp, Sprache, Zeitzone, optional 2FA-Schlüssel (verschlüsselt).</li>
          <li><strong>Profil:</strong> freiwillige Angaben, Fotos und Videos (EXIF- und GPS-Daten werden beim Upload entfernt), Stadt und Radius – nie die exakte Adresse von Escorts.</li>
          <li><strong>Nutzung:</strong> Nachrichten, Beiträge, Kommentare, Berichte, Favoriten, Buchungen, Profilbesuche (zusammengefasst pro Tag), Mitteilungen.</li>
          <li><strong>Technisch:</strong> IP-Adresse und Browser-Kennung pro Sitzung, Zeitpunkte, Herkunftsland (für die Länder-Sichtbarkeit), Rate-Limit-Zähler.</li>
          <li><strong>Präferenzen</strong> für das Matching werden verschlüsselt gespeichert (AES-256-GCM).</li>
        </ul>
      </LegalSection>
      <LegalSection id="zwecke" title="3. Zwecke & Rechtsgrundlagen">
        <ul>
          <li>Bereitstellung der Plattform und deines Kontos (Vertrag, Art. 6 Abs. 1 lit. b DSGVO).</li>
          <li>Altersverifikation, Sicherheit, Missbrauchs- und Betrugsbekämpfung, Moderation (rechtliche Pflicht und berechtigtes Interesse, lit. c und f).</li>
          <li>Statistiken für Anbieterinnen ohne Bot-Zugriffe und ohne Rückschluss auf Inkognito-Besucher (berechtigtes Interesse, lit. f).</li>
          <li>Transaktionale E-Mails wie Aktivierungscode, Passwort-Reset und Moderationsentscheide (Vertrag).</li>
        </ul>
        <p>Wir verkaufen keine Daten und verwenden keine Werbe-Tracker.</p>
      </LegalSection>
      <LegalSection id="sensibel" title="4. Besonders schützenswerte Daten">
        <p>
          Angaben zum Intimleben gelten als besonders schützenswert (Art. 5 lit. c revDSG, Art. 9 DSGVO). Du entscheidest selbst, was du veröffentlichst; die
          Bearbeitung erfolgt auf Grundlage deiner ausdrücklichen Einwilligung, die du durch Löschen der Angaben oder des Kontos jederzeit widerrufen kannst.
          Ausweisdaten aus der Verifikation speichert Poppsie nicht selbst; sie verbleiben beim KYC-Anbieter. Wir speichern nur das Ergebnis und das Geburtsdatum.
        </p>
      </LegalSection>
      <LegalSection id="hosting" title="5. Hosting & Empfänger">
        <p>
          Server, Datenbank und Medienspeicher befinden sich in der <strong>Schweiz oder der EU</strong>; Backups sind verschlüsselt. Wir setzen sorgfältig
          ausgewählte Auftragsbearbeiter ein:
        </p>
        <ul>
          <li>Hosting und Objektspeicher: <Placeholder>Anbieter, Region</Placeholder></li>
          <li>E-Mail-Versand: Resend (<Placeholder>Region</Placeholder>)</li>
          <li>Bot-Schutz bei der Registrierung: Cloudflare Turnstile</li>
          <li>Identitäts- und Altersprüfung: <Placeholder>KYC-Anbieter</Placeholder></li>
        </ul>
        <p>
          Übermittlungen in Länder ohne angemessenes Datenschutzniveau erfolgen nur mit geeigneten Garantien (z. B. EU-Standardvertragsklauseln). Behörden
          erhalten Daten nur auf gesetzlicher Grundlage, etwa bei Verdacht auf Menschenhandel oder Ausbeutung Minderjähriger.
        </p>
      </LegalSection>
      <LegalSection id="cookies" title="6. Cookies">
        <p>Wir verwenden nur technisch notwendige Cookies:</p>
        <ul>
          <li><code>pp_session</code> – Anmeldung (HttpOnly, Secure, 30 Tage)</li>
          <li><code>pp_age</code> – Bestätigung der Altersabfrage (1 Jahr)</li>
          <li><code>pp_locale</code> – gewählte Sprache (1 Jahr)</li>
        </ul>
      </LegalSection>
      <LegalSection id="dauer" title="7. Speicherdauer & Löschung">
        <ul>
          <li>Kontodaten speichern wir, solange dein Konto besteht.</li>
          <li>
            Wenn du dein Konto <Link href="/dashboard/einstellungen#loeschen">löschst</Link>, wird dein Profil sofort ausgeblendet und alle persönlichen Daten
            (Profil, Medien, Nachrichten, Favoriten, Buchungen, Statistiken) werden <strong>innerhalb von 30 Tagen</strong> endgültig entfernt. Von dir verfasste
            Berichte bleiben anonymisiert erhalten.
          </li>
          <li>Sitzungen laufen nach 30 Tagen ab; Rohdaten der Statistik werden aggregiert.</li>
          <li>Moderations- und Audit-Protokolle bewahren wir zur Beweissicherung so lange auf, wie es gesetzlich erforderlich ist.</li>
        </ul>
      </LegalSection>
      <LegalSection id="rechte" title="8. Deine Rechte">
        <ul>
          <li><strong>Auskunft & Datenherausgabe:</strong> Lade deine Daten jederzeit als JSON-Datei herunter – <Link href="/dashboard/einstellungen#export">Datenexport</Link>.</li>
          <li><strong>Berichtigung:</strong> Die meisten Angaben änderst du direkt im Profil oder in den Kontoeinstellungen.</li>
          <li><strong>Löschung:</strong> selbst in den Kontoeinstellungen, Umsetzung innerhalb von 30 Tagen.</li>
          <li><strong>Widerspruch und Widerruf</strong> von Einwilligungen mit Wirkung für die Zukunft.</li>
          <li>
            <strong>Beschwerde</strong> beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) oder, in der EU, bei der zuständigen
            Aufsichtsbehörde.
          </li>
        </ul>
        <p>
          Anfragen an <a href="mailto:datenschutz@poppsie.ch">datenschutz@poppsie.ch</a> beantworten wir innerhalb von 30 Tagen.
        </p>
      </LegalSection>
      <LegalSection id="sicherheit" title="9. Datensicherheit">
        <p>
          Verschlüsselte Verbindungen (TLS), Passwort-Hashing mit Argon2id, Prüfung gegen bekannte Datenlecks, optionale Zwei-Faktor-Anmeldung, signierte und
          ablaufende Medien-Links mit Hotlink-Schutz, Unschärfe-Varianten für Gäste, Rate-Limits und ein Audit-Log für alle Admin-Aktionen.
        </p>
      </LegalSection>
      <LegalSection id="aenderungen" title="10. Änderungen">
        <p>Wir passen diese Erklärung an, wenn sich unsere Bearbeitungen ändern. Die jeweils aktuelle Fassung ist hier abrufbar.</p>
      </LegalSection>
    </LegalPage>
  );
}
