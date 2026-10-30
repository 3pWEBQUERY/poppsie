import { Lock } from "lucide-react";

/** Hinweis für Nicht-Mitglieder privater Gruppen. */
export function GroupLocked({ text = "Die Inhalte dieser Gruppe sind nur für Mitglieder sichtbar." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-14 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
