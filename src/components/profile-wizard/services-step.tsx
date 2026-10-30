"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MultiSelect, Select } from "@/components/shared/select/select";
import { DURATIONS, SERVICE_GROUPS, WORKPLACES } from "@/lib/profile/fields";
import type { EscortServices } from "@/lib/profiles/schemas";
import { cn } from "@/lib/utils";
import { Field, Section } from "./field";
import { toOptions } from "./options";
import { patcher, type StepProps } from "./types";

const SERVICE_OPTIONS = SERVICE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

const RULES = [
  { value: "all", label: "Alle Mitglieder" },
  { value: "verified", label: "Nur verifizierte Mitglieder" },
  { value: "with_review", label: "Nur Mitglieder mit mind. 1 Bericht" },
  { value: "followers", label: "Nur Follower" },
];

export function ServicesStep({ value, onChange, errors }: StepProps<EscortServices>) {
  const set = patcher(value, onChange);
  const prices = value.prices ?? [];
  const used = new Set(prices.map((p) => p.minutes));
  const nextDuration = DURATIONS.find((d) => !used.has(Number(d.value)));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Services">
        <Field label="Was bietest du an?" error={errors.services} required>
          <MultiSelect
            options={SERVICE_OPTIONS}
            value={value.services ?? []}
            onChange={(v) => set("services", v)}
            searchable
            searchPlaceholder="Service suchen"
            placeholder="Services wählen"
            sheetTitle="Services"
            aria-label="Services"
            invalid={Boolean(errors.services)}
          />
        </Field>
      </Section>

      <Section title="Preise">
        <div className="flex flex-col gap-2">
          {prices.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Preise. Lege mindestens einen Preis fest.</p>}
          {prices.map((p, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                <Select
                  options={DURATIONS.map((d) => ({ ...d, disabled: used.has(Number(d.value)) && Number(d.value) !== p.minutes }))}
                  value={String(p.minutes)}
                  onChange={(v) => v && set("prices", prices.map((x, j) => (j === i ? { ...x, minutes: Number(v) } : x)))}
                  aria-label="Dauer"
                />
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={Number.isFinite(p.price) && p.price ? p.price : ""}
                    aria-label="Preis in CHF"
                    aria-invalid={Boolean(errors[`prices.${i}.price`])}
                    onChange={(e) => set("prices", prices.map((x, j) => (j === i ? { ...x, price: e.target.value === "" ? 0 : Number(e.target.value) } : x)))}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">CHF</span>
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Preis entfernen" onClick={() => set("prices", prices.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
              {(errors[`prices.${i}.price`] || errors[`prices.${i}.minutes`]) && (
                <p role="alert" className="text-xs text-destructive">
                  {errors[`prices.${i}.price`] ?? errors[`prices.${i}.minutes`]}
                </p>
              )}
            </div>
          ))}
          {errors.prices && (
            <p role="alert" className="text-xs text-destructive">
              {errors.prices}
            </p>
          )}
          {nextDuration && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => set("prices", [...prices, { minutes: Number(nextDuration.value), price: 0 }])}
            >
              <Plus /> Preis hinzufügen
            </Button>
          )}
        </div>
      </Section>

      <Section title="Arbeitsort">
        <div role="radiogroup" aria-label="Arbeitsort" className="flex flex-wrap gap-2">
          {WORKPLACES.map((w) => (
            <button
              key={w.value}
              type="button"
              role="radio"
              aria-checked={value.workplace === w.value}
              onClick={() => set("workplace", w.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:border-foreground",
                value.workplace === w.value && "border-foreground bg-foreground text-background",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
        {errors.workplace && <p className="text-xs text-destructive">{errors.workplace}</p>}
      </Section>

      <Section title="Connect">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <label className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Direkt anschreiben erlauben</span>
              <span className="text-xs text-muted-foreground">Ist Connect aus, erreichen dich Mitglieder nur über eine Buchungsanfrage.</span>
            </span>
            <Switch checked={value.connectEnabled} onCheckedChange={(v) => set("connectEnabled", v)} aria-label="Connect" />
          </label>
          <Field label="Wer darf dich anschreiben?">
            <Select
              options={toOptions(RULES)}
              value={value.connectRule}
              onChange={(v) => v && set("connectRule", v as EscortServices["connectRule"])}
              disabled={!value.connectEnabled}
              aria-label="Wer darf dich anschreiben?"
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
