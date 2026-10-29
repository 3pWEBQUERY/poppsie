"use client";

import { Clock } from "lucide-react";
import { MultiSelect } from "@/components/shared/select/select";
import { CLUB_TYPES } from "@/lib/profile/fields";
import { WELLNESS, type ClubFilters } from "@/lib/search/filters";
import { Field, FilterSection, SingleSlider, TogglePill } from "./fields";

/** Dynamisches Feld aus club_type_schemas, das sich als Filter eignet. */
export type ClubFilterField = { key: string; label: string; input: "boolean" | "multiselect" | "number"; options?: string[] };

type Props = { value: ClubFilters; onChange: (next: ClubFilters) => void; fields: ClubFilterField[] };

const ENTRY_MAX = 200;

export function ClubFilterFields({ value: f, onChange, fields }: Props) {
  const set = (patch: Partial<ClubFilters>) => onChange({ ...f, ...patch, seite: 1 });
  const setExtra = (patch: Partial<ClubFilters["extra"]>) => set({ extra: { ...f.extra, ...patch } });
  const bools = fields.filter((x) => x.input === "boolean");
  const multis = fields.filter((x) => x.input === "multiselect");
  const numbers = fields.filter((x) => x.input === "number");
  const extraCount = f.extra.bool.length + Object.keys(f.extra.multi).length + Object.keys(f.extra.min).length;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 pb-4">
        <TogglePill active={f.offen} onClick={() => set({ offen: !f.offen })}>
          <Clock /> Jetzt geöffnet
        </TogglePill>
        {bools.map((b) => (
          <TogglePill
            key={b.key}
            active={f.extra.bool.includes(b.key)}
            onClick={() => setExtra({ bool: f.extra.bool.includes(b.key) ? f.extra.bool.filter((k) => k !== b.key) : [...f.extra.bool, b.key] })}
          >
            {b.label}
          </TogglePill>
        ))}
      </div>
      <FilterSection title="Betrieb" defaultOpen count={(f.clubtyp.length ? 1 : 0) + (f.eintritt != null ? 1 : 0) + (f.wellness.length ? 1 : 0)}>
        <Field label="Club-Typ">
          <MultiSelect options={CLUB_TYPES} value={f.clubtyp} onChange={(clubtyp) => set({ clubtyp })} placeholder="Alle Typen" clearable sheetTitle="Club-Typ" aria-label="Club-Typ" />
        </Field>
        <SingleSlider
          label="Eintritt bis"
          min={0}
          max={ENTRY_MAX}
          step={5}
          value={f.eintritt ?? ENTRY_MAX}
          format={(n) => (n >= ENTRY_MAX ? "Alle" : `${n} CHF`)}
          onChange={(n) => set({ eintritt: n >= ENTRY_MAX ? null : n })}
        />
        <Field label="Wellness">
          <MultiSelect
            options={WELLNESS.map((w) => ({ value: w, label: w }))}
            value={f.wellness}
            onChange={(wellness) => set({ wellness })}
            placeholder="Egal"
            clearable
            sheetTitle="Wellness"
            aria-label="Wellness"
          />
        </Field>
      </FilterSection>
      {(multis.length > 0 || numbers.length > 0) && (
        <FilterSection title="Ausstattung" count={extraCount - f.extra.bool.length}>
          {multis.map((m) => (
            <Field key={m.key} label={m.label}>
              <MultiSelect
                options={(m.options ?? []).map((o) => ({ value: o, label: o }))}
                value={f.extra.multi[m.key] ?? []}
                onChange={(v) => {
                  const multi = { ...f.extra.multi };
                  if (v.length) multi[m.key] = v;
                  else delete multi[m.key];
                  setExtra({ multi });
                }}
                placeholder="Egal"
                clearable
                sheetTitle={m.label}
                aria-label={m.label}
              />
            </Field>
          ))}
          {numbers.map((n) => (
            <SingleSlider
              key={n.key}
              label={`${n.label} (mind.)`}
              min={0}
              max={50}
              value={f.extra.min[n.key] ?? 0}
              format={(v) => (v === 0 ? "Egal" : `ab ${v}`)}
              onChange={(v) => {
                const min = { ...f.extra.min };
                if (v > 0) min[n.key] = v;
                else delete min[n.key];
                setExtra({ min });
              }}
            />
          ))}
        </FilterSection>
      )}
    </div>
  );
}
