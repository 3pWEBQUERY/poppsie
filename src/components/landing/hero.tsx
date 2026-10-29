"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarCheck, ChevronRight, Lock, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { TornEdge } from "./torn-edge";

const SLIDE_LINKS = ["/#was-ist-poppsie", "/sicherheit#verifikation", "/#buchen", "/forum"];

/**
 * Hero nach Vorlage 1: helle Fläche, grosse Versal-Headline mit Slider-Punkten, dunkle Anmeldekarte rechts,
 * gerissene Kante zum dunklen Bereich mit Script-Claim. Eigene Fotos: /public/hero/slide-1.jpg … slide-4.jpg.
 */
export function Hero({ t, images }: { t: Messages["hero"]; images: (string | null)[] }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % t.slides.length), 7000);
    return () => clearInterval(id);
  }, [paused, t.slides.length]);
  const current = t.slides[slide]!;
  const image = images[slide] ?? images[0] ?? null;

  return (
    <section className="relative overflow-hidden bg-paper text-paper-foreground" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative mx-auto grid min-h-[480px] max-w-6xl gap-8 px-4 pt-10 pb-40 md:grid-cols-[1fr_auto_280px] md:pb-48">
        <div className="relative z-10 flex flex-col gap-4">
          <h1 key={slide} className="animate-in fade-in-0 font-display text-4xl leading-[1.05] font-extrabold whitespace-pre-line uppercase sm:text-5xl">
            {current.title}
          </h1>
          <Link href={SLIDE_LINKS[slide] ?? "/"} className="inline-flex w-fit items-center gap-1 text-sm font-semibold underline underline-offset-4">
            <ChevronRight className="size-4" /> {current.link}
          </Link>
          <div className="mt-6 flex gap-2.5" role="tablist" aria-label="Slides">
            {t.slides.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === slide}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={cn("size-3.5 rounded-full border-2 border-paper-foreground transition-colors", i === slide && "bg-paper-foreground")}
              />
            ))}
          </div>
        </div>

        <div className="relative z-0 hidden md:block md:w-[300px] lg:w-[360px]">{image ? <HeroImage src={image} /> : <HeroCollage />}</div>

        <div className="relative z-10 md:pt-6">
          <div className="rounded-xl bg-[#141619] p-5 text-white">
            <p className="mb-3 text-center text-sm font-semibold">{t.signup}</p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/registrieren?typ=member">{t.asMember}</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/registrieren?typ=escort">{t.asEscort}</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/registrieren?typ=club">{t.asClub}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <TornEdge className="pointer-events-none absolute inset-x-0 bottom-0 h-[150px] w-full md:h-[200px]" />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-6">
          <p className="font-script text-4xl leading-none text-white -rotate-6 sm:text-5xl">{t.tagline}</p>
          <div className="hidden flex-col items-end gap-3 text-white sm:flex">
            <Link href="/registrieren?typ=club" className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">
              <ChevronRight className="size-3.5" /> {t.business}
            </Link>
            <div className="flex gap-2">
              <TrustBadge icon={<BadgeCheck className="size-4 text-primary" />} title="Verifizierte" sub="Profile (KYC)" />
              <TrustBadge icon={<Lock className="size-4 text-primary" />} title="Hosting" sub="Schweiz / EU" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBadge({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <span className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[#141619]">
      {icon}
      <span className="leading-tight">
        <span className="block text-[11px] font-bold">{title}</span>
        <span className="block text-[10px]">{sub}</span>
      </span>
    </span>
  );
}

function HeroImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="absolute bottom-[-120px] left-1/2 h-[560px] max-w-none -translate-x-1/2 object-contain" />;
}

/** Fallback ohne Foto: flache Komposition aus Profilkarte, Bewertung und Buchung (keine Verläufe, keine Schatten). */
function HeroCollage() {
  return (
    <div className="absolute inset-x-0 top-2 h-[420px]">
      <div className="absolute top-6 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary" />
      <div className="absolute top-0 left-1/2 w-52 -translate-x-[70%] -rotate-6 rounded-xl border-2 border-paper-foreground bg-white p-3">
        <div className="mb-3 flex aspect-[4/5] items-center justify-center rounded-lg bg-[#141619]">
          <LogoMark className="h-14 text-primary" />
        </div>
        <div className="flex items-center gap-1 font-display text-sm font-bold">
          Sophie, 27 <BadgeCheck className="size-4 text-primary" />
        </div>
        <div className="text-xs text-neutral-500">Zürich · 3 km</div>
      </div>
      <div className="absolute top-24 right-0 w-44 rotate-3 rounded-xl border-2 border-paper-foreground bg-white p-3">
        <div className="mb-1 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="size-4 fill-primary text-primary" />
          ))}
        </div>
        <p className="text-xs font-semibold">„Genau wie auf den Fotos – sehr herzlich.“</p>
        <p className="mt-1 text-[10px] text-neutral-500">Verifiziertes Treffen</p>
      </div>
      <div className="absolute top-64 left-2 flex w-48 -rotate-2 items-center gap-2 rounded-xl border-2 border-paper-foreground bg-[#141619] p-3 text-white">
        <CalendarCheck className="size-6 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-bold">Termin bestätigt</p>
          <p className="text-[10px] text-neutral-400">Fr, 20:00 · 2 Std.</p>
        </div>
      </div>
      <div className="absolute top-56 right-6 flex items-center gap-2 rounded-full border-2 border-paper-foreground bg-white px-3 py-1.5">
        <MessageCircle className="size-4 text-primary" />
        <span className="text-xs font-semibold">Connect</span>
      </div>
    </div>
  );
}
