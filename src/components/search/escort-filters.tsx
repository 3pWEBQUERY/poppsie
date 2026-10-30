"use client";

import { BadgeCheck, CalendarCheck, CircleDot, Sparkles } from "lucide-react";
import { MultiSelect } from "@/components/shared/select/select";
import { StarRating } from "@/components/shared/star-rating";
import { RANGES, type EscortFilters, type EscortListKey, type RangeKey } from "@/lib/search/filters";
import { Field, FilterSection, RangeField, Segmented, TogglePill } from "./fields";
import { LIST_LABELS, listOptions } from "./list-options";

type Props = { value: EscortFilters; onChange: (next: EscortFilters) => void };

const RANGE_META: Record<RangeKey, { label: string; unit: string; step?: number }> = {
  alter: { label: "Alter", unit: "" },
  groesse: { label: "Grösse", unit: " cm" },
  gewicht: { label: "Gewicht", unit: " kg" },
  preis: { label: "Preis (1 Stunde)", unit: " CHF", step: 10 },
};

export function EscortFilterFields({ value: f, onChange }: Props) {
  const set = <K extends keyof EscortFilters>(k: K, v: EscortFilters[K]) => onChange({ ...f, [k]: v, seite: 1 });
  const list = (k: EscortListKey) => {
    const o = listOptions(k);
    return (
      <Field key={k} label={LIST_LABELS[k]}>
        <MultiSelect
          options={o.options}
          searchable={o.searchable}
          searchPlaceholder={`${LIST_LABELS[k]} suchen`}
          value={f[k]}
          onChange={(v) => set(k, v)}
          placeholder="Alle"
          clearable
          sheetTitle={LIST_LABELS[k]}
          aria-label={LIST_LABELS[k]}
        />
      </Field>
    );
  };
  const range = (k: RangeKey) => (
    <RangeField key={k} label={RANGE_META[k].label} unit={RANGE_META[k].unit} step={RANGE_META[k].step} min={RANGES[k][0]} max={RANGES[k][1]} value={f[k]} onChange={(v) => set(k, v)} />
  );
  const count = (keys: (keyof EscortFilters)[]) =>
    keys.filter((k) => {
      const v = f[k];
      return Array.isArray(v) ? v.length > 0 : v != null && v !== false;
    }).length;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 pb-4">
        <TogglePill active={f.heute} onClick={() => set("heute", !f.heute)}>
          <CalendarCheck /> Heute verfügbar
        </TogglePill>
        <TogglePill active={f.neu} onClick={() => set("neu", !f.neu)}>
          <Sparkles /> Neu
        </TogglePill>
        <TogglePill active={f.verifiziert} onClick={() => set("verifiziert", !f.verifiziert)}>
          <BadgeCheck /> Foto verifiziert
        </TogglePill>
        <TogglePill active={f.story} onClick={() => set("story", !f.story)}>
          <CircleDot /> Mit Story
        </TogglePill>
      </div>
      <FilterSection title="Person" defaultOpen count={count(["alter", "geschlecht", "nat", "sprachen"])}>
        {range("alter")}
        {list("geschlecht")}
        {list("nat")}
        {list("sprachen")}
      </FilterSection>
      <FilterSection title="Aussehen" count={count(["groesse", "gewicht", "cup", "brust", "intim", "haare", "augen", "piercings", "tattoos"])}>
        {range("groesse")}
        {range("gewicht")}
        {list("cup")}
        {list("brust")}
        {list("intim")}
        {list("haare")}
        {list("augen")}
        {list("piercings")}
        {list("tattoos")}
      </FilterSection>
      <FilterSection title="Stil & Grössen" count={count(["stil", "kleidung", "schuhe"])}>
        {list("stil")}
        {list("kleidung")}
        {list("schuhe")}
      </FilterSection>
      <FilterSection title="Services & Preis" defaultOpen count={count(["services", "preis", "ort", "bewertung"])}>
        {list("services")}
        {range("preis")}
        <Field label="Treffpunkt">
          <Segmented
            label="Treffpunkt"
            value={f.ort ?? "alle"}
            onChange={(v) => set("ort", v === "alle" ? null : v)}
            options={[
              { value: "alle", label: "Alle" },
              { value: "incall", label: "Incall" },
              { value: "outcall", label: "Outcall" },
            ]}
          />
        </Field>
        <Field
          label="Bewertung ab"
          hint={
            f.bewertung ? (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => set("bewertung", null)}>
                Zurücksetzen
              </button>
            ) : (
              <span className="text-muted-foreground">Alle</span>
            )
          }
        >
          <StarRating value={f.bewertung ?? 0} onChange={(v) => set("bewertung", v)} label="Bewertung ab" />
        </Field>
      </FilterSection>
    </div>
  );
}
