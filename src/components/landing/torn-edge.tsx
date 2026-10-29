/** Gerissene Papierkante (weiss → dunkel) als SVG-Fläche, ohne Verlauf und ohne Schatten. */
function tornPath(width: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pts: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    // Diagonaler Riss: links tiefer, rechts höher, mit unregelmässigen Zacken
    const base = 150 - (i / steps) * 95;
    const y = base + (rnd() - 0.5) * 16 + (i % 7 === 0 ? (rnd() - 0.5) * 22 : 0);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,220 L${pts.join(" L")} L${width},220 Z`;
}

export function TornEdge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={tornPath(1440, 7)} fill="#d9d9d9" transform="translate(0,-6)" />
      <path d={tornPath(1440, 7)} fill="var(--background)" />
    </svg>
  );
}
