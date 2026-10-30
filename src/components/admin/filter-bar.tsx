"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/shared/select/select";

export type FilterDef =
  | { kind: "select"; name: string; label: string; options: SelectOption[]; value: string; placeholder?: string }
  | { kind: "text"; name: string; label: string; value: string; placeholder?: string };

/** Filterleiste: schreibt die Werte in die URL (Seite wird zurückgesetzt). */
export function FilterBar({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(filters.filter((f) => f.kind === "text").map((f) => [f.name, f.value])));

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("seite");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const hasAny = filters.some((f) => f.value);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(texts);
      }}
    >
      {filters.map((f) =>
        f.kind === "select" ? (
          <div key={f.name} className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-[11px] font-semibold text-muted-foreground">{f.label}</span>
            <Select aria-label={f.label} options={f.options} value={f.value || null} placeholder={f.placeholder ?? "Alle"} clearable onChange={(v) => apply({ [f.name]: v })} />
          </div>
        ) : (
          <label key={f.name} className="flex w-full flex-col gap-1 sm:w-56">
            <span className="text-[11px] font-semibold text-muted-foreground">{f.label}</span>
            <Input
              value={texts[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setTexts((t) => ({ ...t, [f.name]: e.target.value }))}
              className="h-9"
            />
          </label>
        ),
      )}
      {filters.some((f) => f.kind === "text") && (
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          <Search /> Suchen
        </Button>
      )}
      {hasAny && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setTexts({});
            router.push(pathname);
          }}
        >
          <X /> Zurücksetzen
        </Button>
      )}
    </form>
  );
}
