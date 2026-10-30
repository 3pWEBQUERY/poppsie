import Link from "next/link";
import { Apple } from "lucide-react";
import { getMessages } from "@/lib/i18n/server";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";

type Col = { title: string; links: { href: string; label: string }[] };

/** Footer nach Vorlage 1: Spalten auf einer abgesetzten Fläche, App-Hinweis, Copyright. */
export async function SiteFooter() {
  const { locale, t } = await getMessages();
  const cols: Col[] = [
    {
      title: t.footer.discover,
      links: [
        { href: "/suche", label: "Escorts" },
        { href: "/suche?typ=club", label: "Clubs & Studios" },
        { href: "/suche?typ=club&clubTyp=saunaclub", label: "Saunaclubs" },
        { href: "/stories", label: "Stories" },
      ],
    },
    {
      title: t.footer.community,
      links: [
        { href: "/feed", label: "Newsfeed" },
        { href: "/forum", label: "Forum" },
        { href: "/gruppen", label: "Gruppen" },
        { href: "/dashboard/nachrichten", label: "Messenger" },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: "/agb", label: "Nutzungsbedingungen" },
        { href: "/impressum", label: "Impressum" },
        { href: "/datenschutz", label: "Datenschutz" },
        { href: "/sicherheit", label: "Sicherheit & Jugendschutz" },
        { href: "/barrierefreiheit", label: "Barrierefreiheit" },
        { href: "/dashboard/einstellungen#loeschen", label: "Konto löschen" },
      ],
    },
  ];
  return (
    <footer className="mt-16 bg-background pb-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 rounded-lg bg-card px-6 py-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Logo />
              <FooterLinks
                links={[
                  { href: "/#was-ist-poppsie", label: "Was ist Poppsie?" },
                  { href: "/sicherheit#verifikation", label: "Verifikation" },
                  { href: "/registrieren", label: "Kostenlos anmelden" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold">{t.footer.help}</h3>
              <FooterLinks
                links={[
                  { href: "/hilfe", label: "Hilfe & FAQ" },
                  { href: "/sicherheit#melden", label: "Inhalt melden" },
                ]}
              />
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold">{c.title}</h3>
              <FooterLinks links={c.links} />
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 border-t pt-10 text-center">
          <p className="text-xs font-semibold text-muted-foreground">{t.footer.app}</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-md border border-foreground/40 px-3 py-1.5 text-left">
              <Apple className="size-5" />
              <span className="leading-tight">
                <span className="block text-[9px] text-muted-foreground">Bald im</span>
                <span className="block text-sm font-semibold">App Store</span>
              </span>
            </span>
            <LocaleSwitcher locale={locale} />
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Poppsie · Nur für Erwachsene (18+)</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
