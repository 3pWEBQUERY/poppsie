import { cn } from "@/lib/utils";

/** Abschnitt der Kontoeinstellungen (Anker-ID für Direktlinks, z. B. #loeschen). */
export function SettingsSection({
  id,
  title,
  description,
  children,
  tone,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section id={id} className={cn("scroll-mt-28 rounded-lg border bg-card", tone === "danger" && "border-destructive/50")}>
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 className={cn("text-base font-bold", tone === "danger" && "text-destructive")}>{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
