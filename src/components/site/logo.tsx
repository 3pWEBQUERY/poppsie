import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wortmarke mit Punkt-Herz (aus Kreisen gebaut, ohne Verlauf). */
export function LogoMark({ className }: { className?: string }) {
  const dots: [number, number][] = [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
  ];
  return (
    <svg viewBox="0 0 28 24" className={cn("h-5 w-auto", className)} aria-hidden>
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x * 4 + 2} cy={y * 4 + 2} r={1.6} fill="currentColor" />
      ))}
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 font-display text-lg font-extrabold tracking-tight", className)}>
      <LogoMark className="text-primary" />
      <span>
        popp<span className="text-primary">sie</span>
      </span>
    </Link>
  );
}
