import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalSection, Placeholder } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Nutzungsbedingungen (AGB)", description: "Allgemeine Geschäfts- und Nutzungsbedingungen von Poppsie." };

const TOC = [
  { id: "geltung", label: "Geltungsbereich" },
  { id: "alter", label: "Mindestalter & Konto" },
  { id: "kontotypen", label: "Kontotypen & Verifikation" },
  { id: "pflichten", label: "Pflichten aller Nutzer" },
  { id: "verboten", label: "Verbotene Inhalte" },
  { id: "anbieter", label: "Pflichten von Anbieterinnen" },
  { id: "buchungen", label: "Buchungen & Treffen" },
  { id: "berichte", label: "Berichte & Bewertungen" },
  { id: "moderation", label: "Moderation, Sperren, Einspruch" },
  { id: "rechte", label: "Rechte an Inhalten" },
  { id: "haftung", label: "Haftung" },
  { id: "ende", label: "Kündigung & Löschung" },
  { id: "schluss", label: "Schlussbestimmungen" },
];

export default function AgbPage() {
  return (
    <LegalPage
      title="Nutzungsbedingungen"
      updated="29. Oktober 2026"
      toc={TOC}
      intro="Diese Bedingungen regeln die Nutzung von Poppsie – der Community für Erwachsene mit Escorts, Clubs, Studios und Mitgliedern in der Schweiz."
    >
      <LegalSection id="geltung" title="1. Geltungsbereich">
        <p>
          Diese Nutzungsbedingungen gelten für alle Personen, die Poppsie nutzen (Website und künftige Apps). Betreiberin ist <Placeholder>Firmenname</Placeholder>,{" "}
          <Placeholder>Adresse</Placeholder> (nachfolgend «Poppsie», «wir»). Mit der Registrierung akzeptierst du diese Bedingungen und die{" "}
          <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </LegalSection>
      <LegalSection id="alter" title="2. Mindestalter & Konto">
        <ul>
          <li>Poppsie ist ausschliesslich für volljährige Personen ab 18 Jahren. Mit der Registrierung bestätigst du, dass du mindestens 18 Jahre alt bist.</li>
          <li>Pro Person ist ein Konto erlaubt. Angaben bei der Registrierung müssen wahr sein; der Benutzername darf keine Rechte Dritter verletzen.</li>
          <li>Du hältst deine Zugangsdaten geheim. Wir empfehlen die Zwei-Faktor-Anmeldung in den Kontoeinstellungen.</li>
        </ul>
      </LegalSection>
      <LegalSection id="kontotypen" title="3. Kontotypen & Verifikation">
        <p>
          Es gibt Konten für Mitglieder, Escorts sowie Clubs und Studios. Escorts und Betreiber von Clubs/Studios müssen vor der Freischaltung ihres öffentlichen
          Profils ihre Identität und ihr Alter verifizieren (KYC). Details beschreibt die Seite <Link href="/sicherheit#verifikation">Sicherheit & Verifikation</Link>.
        </p>
      </LegalSection>
      <LegalSection id="pflichten" title="4. Pflichten aller Nutzer">
        <ul>
          <li>Respektvoller Umgang; keine Belästigung, Drohungen, Diskriminierung oder Erpressung.</li>
          <li>Keine Weitergabe persönlicher Daten anderer (z. B. Klarnamen, Adressen, Fotos ohne Einwilligung).</li>
          <li>Keine Werbung für externe Dienste, kein Spam, keine Fake-Profile oder Mehrfachkonten.</li>
          <li>Einhaltung des geltenden Rechts, insbesondere des Strafgesetzbuchs und kantonaler Vorschriften.</li>
        </ul>
      </LegalSection>
      <LegalSection id="verboten" title="5. Verbotene Inhalte">
        <p>Strikt verboten und werden umgehend entfernt sowie gegebenenfalls den Behörden gemeldet:</p>
        <ul>
          <li>jegliche Darstellung oder Andeutung von Minderjährigen in sexuellem Kontext;</li>
          <li>Hinweise auf Zwang, Ausbeutung oder Menschenhandel;</li>
          <li>Inhalte ohne Einwilligung der abgebildeten Personen, Gewalt- oder illegale Pornografie;</li>
          <li>Angebote ungeschützter Praktiken, Drogen oder anderer illegaler Leistungen.</li>
        </ul>
      </LegalSection>
      <LegalSection id="anbieter" title="6. Pflichten von Anbieterinnen">
        <ul>
          <li>Escorts, Clubs und Studios sind selbst dafür verantwortlich, die kantonalen Vorgaben einzuhalten (z. B. Meldepflicht, Bewilligungen für Salons, Werbevorschriften).</li>
          <li>Fotos müssen aktuell sein und die werbende Person zeigen; Poppsie kann eine Foto-Verifikation verlangen.</li>
          <li>Preise und Leistungen sind wahrheitsgemäss anzugeben. Sexarbeit erfolgt selbstbestimmt und freiwillig.</li>
        </ul>
      </LegalSection>
      <LegalSection id="buchungen" title="7. Buchungen & Treffen">
        <p>
          Poppsie stellt eine Kalender- und Buchungsfunktion bereit. Ein Vertrag über ein Treffen kommt ausschliesslich zwischen den beteiligten Personen zustande;
          Poppsie ist nicht Vertragspartei und übernimmt keine Gewähr für das Zustandekommen oder die Durchführung. Absagen sollen frühzeitig über die Plattform
          erfolgen.
        </p>
      </LegalSection>
      <LegalSection id="berichte" title="8. Berichte & Bewertungen">
        <p>
          Berichte müssen auf eigenen Erfahrungen beruhen, sachlich sein und dürfen keine identifizierenden Angaben über Dritte enthalten. Bewertete Personen
          können einmal öffentlich antworten. Wir können Berichte ausblenden, die gegen diese Regeln verstossen. Bei einer Kontolöschung bleiben Berichte
          anonymisiert bestehen.
        </p>
      </LegalSection>
      <LegalSection id="moderation" title="9. Moderation, Sperren & Einspruch">
        <ul>
          <li>Inhalte und Profile können über die Meldefunktion gemeldet werden. Meldungen zu Minderjährigkeit, Zwang oder Menschenhandel werden priorisiert.</li>
          <li>Bei Verstössen können wir verwarnen, Inhalte entfernen, Profile ausblenden oder Konten temporär oder dauerhaft sperren. Du erhältst immer eine Begründung.</li>
          <li>Gegen Entscheide kannst du innerhalb von 90 Tagen in den <Link href="/dashboard/einstellungen#moderation">Kontoeinstellungen</Link> Einspruch erheben; eine andere Person aus dem Team prüft ihn.</li>
        </ul>
      </LegalSection>
      <LegalSection id="rechte" title="10. Rechte an Inhalten">
        <p>
          Du behältst die Rechte an deinen Inhalten. Du räumst Poppsie ein einfaches, auf die Dauer der Veröffentlichung beschränktes Recht ein, die Inhalte
          auf der Plattform anzuzeigen und technisch zu verarbeiten (z. B. Vorschaubilder, Unschärfe-Varianten). Du sicherst zu, die nötigen Rechte und
          Einwilligungen zu besitzen.
        </p>
      </LegalSection>
      <LegalSection id="haftung" title="11. Haftung">
        <p>
          Poppsie haftet nur für vorsätzlich oder grobfahrlässig verursachte Schäden, soweit gesetzlich zulässig. Für Inhalte der Nutzer und für Treffen zwischen
          Nutzern übernehmen wir keine Haftung. Eine ständige Verfügbarkeit der Plattform wird nicht garantiert.
        </p>
      </LegalSection>
      <LegalSection id="ende" title="12. Kündigung & Löschung">
        <p>
          Du kannst dein Konto jederzeit in den <Link href="/dashboard/einstellungen#loeschen">Kontoeinstellungen</Link> löschen. Das Profil wird sofort
          ausgeblendet, alle persönlichen Daten werden nach 30 Tagen endgültig entfernt. Wir können Konten bei schweren oder wiederholten Verstössen kündigen.
        </p>
      </LegalSection>
      <LegalSection id="schluss" title="13. Schlussbestimmungen">
        <p>
          Wir können diese Bedingungen anpassen; wesentliche Änderungen kündigen wir rechtzeitig an. Es gilt Schweizer Recht. Gerichtsstand ist{" "}
          <Placeholder>Sitz der Betreiberin</Placeholder>, soweit keine zwingenden Bestimmungen (z. B. Konsumentenschutz) entgegenstehen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
