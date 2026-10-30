import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Barrierefreiheit" };

export default function BarrierefreiheitPage() {
  return (
    <LegalPage
      title="Barrierefreiheit"
      updated="29. Oktober 2026"
      intro="Poppsie soll für alle Erwachsenen nutzbar sein – unabhängig von Einschränkungen oder verwendeten Hilfsmitteln."
    >
      <LegalSection id="ziel" title="Unser Ziel">
        <p>
          Wir orientieren uns an den Web Content Accessibility Guidelines (WCAG) 2.1 auf Stufe AA sowie an den Grundsätzen des Behindertengleichstellungsgesetzes
          (BehiG) und des eCH-0059-Standards.
        </p>
      </LegalSection>
      <LegalSection id="umgesetzt" title="Was bereits umgesetzt ist">
        <ul>
          <li>Alle Auswahlfelder sind per Tastatur bedienbar (Pfeiltasten, Enter, Esc, Typeahead) und folgen dem ARIA-Muster «Combobox/Listbox».</li>
          <li>Sichtbare Fokus-Markierungen, logische Tab-Reihenfolge, Sprungmarken in langen Seiten.</li>
          <li>Hoher Kontrast im dunklen Design, keine reinen Farbsignale ohne Text oder Symbol.</li>
          <li>Alternativtexte für Profilbilder, beschriftete Symbolschaltflächen, Live-Regionen für Fehlermeldungen.</li>
          <li>Skalierbare Schrift und responsive Darstellung bis 320 px Breite.</li>
          <li>Inhalte in Deutsch, Französisch, Italienisch und Englisch.</li>
        </ul>
      </LegalSection>
      <LegalSection id="grenzen" title="Bekannte Einschränkungen">
        <ul>
          <li>Von Nutzerinnen und Nutzern hochgeladene Bilder und Videos haben nicht immer eine Beschreibung bzw. Untertitel.</li>
          <li>Die Kartenansicht in der Suche ist mit Screenreadern nur eingeschränkt nutzbar; die Listenansicht bietet dieselben Ergebnisse.</li>
        </ul>
      </LegalSection>
      <LegalSection id="feedback" title="Feedback & Kontakt">
        <p>
          Stösst du auf eine Barriere? Schreib uns an <a href="mailto:barrierefreiheit@poppsie.ch">barrierefreiheit@poppsie.ch</a> und beschreibe, auf welcher
          Seite und mit welchem Hilfsmittel das Problem auftritt. Wir melden uns innerhalb von 14 Tagen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
