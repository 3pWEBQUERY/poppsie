import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalSection, Placeholder } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum" updated="29. Oktober 2026">
      <LegalSection id="betreiberin" title="Betreiberin">
        <p>
          <Placeholder>Firmenname GmbH</Placeholder>
          <br />
          <Placeholder>Strasse und Nr.</Placeholder>
          <br />
          <Placeholder>PLZ Ort</Placeholder>, Schweiz
        </p>
        <p>
          Handelsregister: <Placeholder>Kanton</Placeholder> · UID: <Placeholder>CHE-xxx.xxx.xxx</Placeholder>
          <br />
          Vertretungsberechtigte Person(en): <Placeholder>Name</Placeholder>
        </p>
      </LegalSection>
      <LegalSection id="kontakt" title="Kontakt">
        <ul>
          <li>
            Allgemein: <a href="mailto:hallo@poppsie.ch">hallo@poppsie.ch</a>
          </li>
          <li>
            Support & Einsprüche: <a href="mailto:support@poppsie.ch">support@poppsie.ch</a>
          </li>
          <li>
            Missbrauch & Behördenanfragen: <a href="mailto:abuse@poppsie.ch">abuse@poppsie.ch</a>
          </li>
          <li>
            Datenschutz: <a href="mailto:datenschutz@poppsie.ch">datenschutz@poppsie.ch</a>
          </li>
        </ul>
        <p>
          Inhalte meldest du am schnellsten direkt über die Meldefunktion – mehr dazu unter <Link href="/sicherheit#melden">Sicherheit</Link>.
        </p>
      </LegalSection>
      <LegalSection id="jugendschutz" title="Jugendschutz">
        <p>
          Poppsie richtet sich ausschliesslich an Erwachsene ab 18 Jahren. Jugendschutzbeauftragte Person: <Placeholder>Name, E-Mail</Placeholder>.
        </p>
      </LegalSection>
      <LegalSection id="haftung" title="Haftungsausschluss">
        <p>
          Für Inhalte der Nutzerinnen und Nutzer sind die jeweiligen Verfasser verantwortlich. Für Inhalte externer Links übernehmen wir keine Haftung; für deren
          Inhalte sind ausschliesslich die Betreiber der verlinkten Seiten verantwortlich.
        </p>
      </LegalSection>
      <LegalSection id="urheberrecht" title="Urheberrecht">
        <p>Die Inhalte und Gestaltung dieser Website sind urheberrechtlich geschützt. Nutzerinhalte bleiben im Eigentum ihrer Urheber.</p>
      </LegalSection>
    </LegalPage>
  );
}
