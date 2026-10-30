"use client";

import { useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/shared/select/select";
import type { ClubFieldDef } from "@/db/schema";
import { WEEKDAYS } from "@/lib/profile/fields";
import type { OpeningHoursInput } from "@/lib/profiles/schemas";
import { Field, NumberField, TextAreaField, TextField } from "./field";
import type { StepProps } from "./types";

type Day = (typeof WEEKDAYS)[number]["key"];
type Range = { from: string; to: string };

export function ClubHoursStep({ value, onChange, errors }: StepProps<{ openingHours: OpeningHoursInput }>) {
  const hours = value.openingHours ?? {};
  const setDay = (day: Day, ranges: Range[]) => onChange({ openingHours: { ...hours, [day]: ranges } });
  const copyToAll = (day: Day) => {
    const src = hours[day] ?? [];
    onChange({ openingHours: Object.fromEntries(WEEKDAYS.map((d) => [d.key, src.map((r) => ({ ...r }))])) as OpeningHoursInput });
  };
  return (
    <div className="flex flex-col divide-y rounded-lg border bg-card">
      {WEEKDAYS.map((d) => {
        const ranges = hours[d.key] ?? [];
        return (
          <div key={d.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
            <div className="flex w-28 shrink-0 items-center justify-between gap-2 pt-1.5 sm:block">
              <span className="text-sm font-semibold">{d.label}</span>
              {ranges.length === 0 && <span className="text-xs text-muted-foreground sm:block">Geschlossen</span>}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {ranges.map((r, i) => {
                const err = errors[`openingHours.${d.key}.${i}`] ?? errors[`openingHours.${d.key}.${i}.from`] ?? errors[`openingHours.${d.key}.${i}.to`];
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={r.from}
                        aria-label={`${d.label} von`}
                        onChange={(e) => setDay(d.key, ranges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
                        className="h-8 w-28"
                      />
                      <span className="text-xs text-muted-foreground">bis</span>
                      <Input
                        type="time"
                        value={r.to}
                        aria-label={`${d.label} bis`}
                        onChange={(e) => setDay(d.key, ranges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                        className="h-8 w-28"
                      />
                      {r.to < r.from && <span className="text-[11px] text-muted-foreground">(+1 Tag)</span>}
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Zeitfenster entfernen" onClick={() => setDay(d.key, ranges.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    </div>
                    {err && <p className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                {ranges.length < 4 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setDay(d.key, [...ranges, ranges.length ? { from: "18:00", to: "23:00" } : { from: "10:00", to: "22:00" }])}>
                    <Plus /> Zeitfenster
                  </Button>
                )}
                {ranges.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => copyToAll(d.key)}>
                    <Copy /> Für alle Tage übernehmen
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListInput({ value, onChange, label, error }: { value: string[]; onChange: (v: string[]) => void; label: string; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-col divide-y rounded-md border">
          {value.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">{item}</span>
              <button type="button" aria-label={`${item} entfernen`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full p-1 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          aria-label={`${label} hinzufügen`}
          aria-invalid={Boolean(error)}
          placeholder="z. B. 60 min: 250 CHF"
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
         
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus /> Hinzufügen
        </Button>
      </div>
    </div>
  );
}

function DetailField({ f, value, onChange, error }: { f: ClubFieldDef; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  const required = f.rule === "required";
  switch (f.input) {
    case "number":
    case "money":
      return (
        <NumberField label={f.label} value={typeof value === "number" ? value : null} onChange={onChange} error={error} required={required} min={0} suffix={f.input === "money" ? "CHF" : undefined} />
      );
    case "boolean":
      return (
        <Field label={f.label} error={error} required={required}>
          <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-card px-3 text-sm">
            <Switch checked={value === true} onCheckedChange={(v) => onChange(v)} aria-label={f.label} />
            {value === true ? "Ja" : value === false ? "Nein" : "Keine Angabe"}
          </label>
        </Field>
      );
    case "multiselect":
      return (
        <Field label={f.label} error={error} required={required}>
          <MultiSelect
            options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            placeholder="Bitte wählen"
            sheetTitle={f.label}
            aria-label={f.label}
            invalid={Boolean(error)}
          />
        </Field>
      );
    case "list":
      return (
        <Field label={f.label} error={error} required={required}>
          <ListInput label={f.label} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} error={error} />
        </Field>
      );
    case "textarea":
      return <TextAreaField label={f.label} value={typeof value === "string" ? value : null} onChange={onChange} error={error} required={required} maxLength={3000} rows={3} />;
    default:
      return <TextField label={f.label} value={typeof value === "string" ? value : null} onChange={onChange} error={error} required={required} maxLength={200} />;
  }
}

export function ClubDetailsStep({ value, onChange, errors, draft }: StepProps<{ data: Record<string, unknown> }>) {
  const data = value.data ?? {};
  const fields = draft.clubFields;
  if (fields.length === 0) return <p className="text-sm text-muted-foreground">Für deinen Betriebstyp sind keine weiteren Angaben nötig.</p>;
  const wide = (f: ClubFieldDef) => f.input === "textarea" || f.input === "list" || f.input === "multiselect";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={wide(f) ? "sm:col-span-2" : undefined}>
          <DetailField f={f} value={data[f.key]} onChange={(v) => onChange({ data: { ...data, [f.key]: v } })} error={errors[`data.${f.key}`] ?? errors[`data.${f.key}.0`]} />
        </div>
      ))}
    </div>
  );
}
