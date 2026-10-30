import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seite nicht gefunden", robots: { index: false } };

/** Globale 404-Seite (rendert im Root-Layout ohne Site-Header). */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 border-t-2 border-t-primary px-4 py-16 text-center">
      <Logo />
      <p className="font-display text-7xl font-extrabold text-primary sm:text-8xl">404</p>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-extrabold">Diese Seite gibt es nicht</h1>
        <p className="text-sm text-muted-foreground">
          Vielleicht wurde das Profil ausgeblendet, gelöscht oder ist in deinem Land nicht sichtbar. Oder der Link ist einfach falsch.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">Zur Startseite</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/suche">Escorts entdecken</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/hilfe">Hilfe</Link>
        </Button>
      </div>
    </div>
  );
}
