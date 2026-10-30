import { cn } from "@/lib/utils";

/** Flagge als runder, vollständig gefüllter Kreis (object-fit: cover via background-size). */
export function Flag({ code, className, title }: { code: string; className?: string; title?: string }) {
  return <span title={title} aria-hidden={!title} className={cn("flag-round fi fis size-5", `fi-${code.toLowerCase()}`, className)} />;
}
