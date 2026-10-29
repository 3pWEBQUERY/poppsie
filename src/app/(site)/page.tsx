import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { and, countDistinct, eq, gt, count } from "drizzle-orm";
import { BadgeCheck, CalendarCheck, CircleCheck, Flame, HeartHandshake, MessagesSquare, PlusCircle, ShieldCheck, Sparkles, Store, UsersRound } from "lucide-react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { Hero } from "@/components/landing/hero";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/utils";

async function stats() {
  const [m] = await db.select({ n: count() }).from(users).where(eq(users.status, "active"));
  const [l] = await db
    .select({ n: countDistinct(sessions.userId) })
    .from(sessions)
    .where(and(gt(sessions.lastUsedAt, new Date(Date.now() - 86400_000))));
  return { members: m?.n ?? 0, logins: l?.n ?? 0 };
}

function heroImages() {
  return [1, 2, 3, 4].map((i) => {
    const file = `/hero/slide-${i}.jpg`;
    return existsSync(path.join(process.cwd(), "public", file)) ? file : null;
  });
}

const FEATURES = [
  {
    icon: BadgeCheck,
    q: "Echt?",
    a: "Aber sicher!",
    text: "Escorts und Betriebe werden per Ausweis und Selfie verifiziert, bevor ihr Profil öffentlich wird. Berichte mit bestätigter Buchung tragen das Label „Verifiziertes Treffen“.",
  },
  {
    icon: Flame,
    q: "Lust auf mehr?",
    a: "Finde dein Match!",
    text: "Speichere deine Vorlieben mit „Muss“ und „Wäre schön“ – Poppsie zeigt dir passende Profile mit Match-Score in Prozent, sortiert nach Distanz, Bewertung oder neu.",
  },
  {
    icon: CalendarCheck,
    q: "Direkt buchen?",
    a: "Ohne Umwege!",
    text: "Freie Termine sehen, Dauer wählen, Anfrage senden. Bestätigung, Gegenvorschlag und Erinnerungen laufen direkt im Chat – Doppelbuchungen sind ausgeschlossen.",
  },
  {
    icon: PlusCircle,
    q: "Diskret & sicher?",
    a: "Deine Regeln!",
    text: "Sperre ganze Länder, blende Bilder für Gäste aus oder surfe inkognito. Meldungen zu Minderjährigkeit, Zwang oder Menschenhandel werden sofort priorisiert.",
  },
];

const TILES = [
  { icon: Sparkles, title: "Stories", text: "Was heute läuft: 24-Stunden-Stories von Escorts und Clubs, mit „Heute verfügbar“ und direktem Link zum Buchen.", href: "/feed" },
  { icon: HeartHandshake, title: "Echte Berichte", text: "Sterne, Teilbewertungen und Antworten der Anbieterinnen – ein Bericht pro Mitglied und Profil alle 30 Tage.", href: "/suche" },
  { icon: Store, title: "Clubs & Studios", text: "Saunaclubs, Laufhäuser, Studios und Nachtclubs mit Öffnungszeiten, Preisen und dem heutigen Line-up.", href: "/suche?typ=club" },
  { icon: MessagesSquare, title: "Forum & Gruppen", text: "Kantone, Themen, Club-Typen: tausch dich aus, gründe Gruppen und teile Threads und Profile.", href: "/forum" },
];

export default async function HomePage() {
  const { t } = await getMessages();
  const s = await stats();
  return (
    <>
      <Hero t={t.hero} images={heroImages()} />

      <div className="bg-band py-5 text-center text-sm sm:text-base">
        {t.landing.band} <strong>{t.landing.bandStrong}</strong>!
      </div>

      <section id="was-ist-poppsie" className="mx-auto max-w-4xl px-4 py-14">
        <div className="grid items-center gap-8 rounded-lg bg-primary p-8 text-white md:grid-cols-[1fr_auto] md:p-12">
          <div>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">Was ist Poppsie?</h2>
            <p className="text-sm leading-relaxed md:text-base">
              Poppsie verbindet Mitglieder, Escorts sowie Clubs und Studios in der Schweiz: Profile, Suche mit Umkreis, Messenger mit
              Connect, Buchung im Chat, Berichte, Stories, Forum und Gruppen – mehrsprachig, international sichtbar nach deinen Regeln.
            </p>
          </div>
          <ShieldCheck className="mx-auto size-24 md:size-32" strokeWidth={1.25} />
        </div>
      </section>

      <StatBand value={s.members} label={t.landing.members} />

      <section className="mx-auto grid max-w-4xl gap-12 px-4 py-14 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.a} className="flex flex-col items-center gap-3 text-center">
            <f.icon className="size-9 text-primary" />
            <h3 className="text-lg leading-tight">
              <span className="block font-medium">{f.q}</span>
              <span className="block font-bold">{f.a}</span>
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <StatBand value={s.logins} label={t.landing.online} />

      <section id="buchen" className="mx-auto grid max-w-4xl gap-4 px-4 py-14 sm:grid-cols-2">
        {TILES.map((tile) => (
          <Link key={tile.title} href={tile.href} className="group flex flex-col overflow-hidden rounded-lg bg-card">
            <div className="flex h-28 items-center justify-center bg-secondary transition-colors group-hover:bg-accent">
              <tile.icon className="size-12 text-primary" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-1 p-4 text-center">
              <h3 className="text-sm font-semibold">{tile.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{tile.text}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-card px-6 py-10 text-center">
          <h2 className="text-lg font-bold">{t.landing.cta}</h2>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["Kostenlos für Mitglieder", "Verifizierte Profile", "Diskret & 18+"].map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5">
                <CircleCheck className="size-3.5 text-success" /> {x}
              </span>
            ))}
          </div>
          <Button size="pill" asChild>
            <Link href="/registrieren">{t.landing.ctaButton}</Link>
          </Button>
          <Link href="/suche" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <UsersRound className="size-3.5" /> Erst mal umsehen
          </Link>
        </div>
      </section>
    </>
  );
}

function StatBand({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-band py-5 text-center">
      <span className="font-display text-lg font-bold underline decoration-primary decoration-2 underline-offset-8">{formatNumber(value)}</span>{" "}
      <span className="text-lg">{label}</span>
    </div>
  );
}
