import { FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rahmen für Rechts- und Infoseiten: Titel, Stand, Entwurfshinweis, Inhaltsverzeichnis. */
export function LegalPage({
  title,
  intro,
  updated,
  draft = true,
  toc,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  updated?: string;
  draft?: boolean;
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {updated && <p className="mt-1 text-xs text-muted-foreground">Stand: {updated}</p>}
        {intro && <div className="mt-3 text-sm text-muted-foreground">{intro}</div>}
      </header>
      {draft && (
        <p role="note" className="mb-6 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <strong>Entwurf – juristische Prüfung vor Launch ausstehend.</strong> Dieser Text ist eine Vorlage und noch nicht rechtsverbindlich.
          </span>
        </p>
      )}
      {toc && toc.length > 0 && (
        <nav aria-label="Inhalt" className="mb-8 rounded-lg border bg-card p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground uppercase">Inhalt</p>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {toc.map((t, i) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground">
                  {i + 1}. {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}

export function LegalSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}

/** Platzhalter für noch fehlende Firmenangaben. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-warning">[{children}]</span>;
}
