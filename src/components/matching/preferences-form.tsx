"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { resetPreferences, savePreferences } from "@/app/(site)/dashboard/praeferenzen/actions";
import { Field, RangeField, Segmented, SingleSlider } from "@/components/search/fields";
import { CITY_OPTIONS } from "@/components/search/options";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { MultiSelect, Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { CRITERION_LABELS, LIST_KEYS, RANGE_KEYS, type Criteria, type CriteriaInput, type Weight } from "@/lib/matching/criteria";
import { RANGES, type EscortListKey } from "@/lib/search/filters";
import { CriterionRow } from "./criterion-row";
import { listOptions } from "@/components/search/list-options";

type RangeDraft = { on: boolean; min: number; max: number; w: Weight };
type ListDraft = { values: string[]; w: Weight };
type Draft = {
  ranges: Record<(typeof RANGE_KEYS)[number], RangeDraft>;
  lists: Record<EscortListKey, ListDraft>;
  ort: { value: "incall" | "outcall" | null; w: Weight };
  region: { stadt: string | null; radius: number; w: Weight };
};

const DEFAULT_RANGE: Record<(typeof RANGE_KEYS)[number], [number, number]> = {
  alter: [21, 35],
  groesse: [155, 180],
  gewicht: [45, 70],
  preis: [200, 500],
};

function toDraft(c: Criteria): Draft {
  const ranges = Object.fromEntries(
    RANGE_KEYS.map((k) => {
      const r = c[k];
      return [k, r ? { on: true, min: r.min, max: r.max, w: r.w } : { on: false, min: DEFAULT_RANGE[k][0], max: DEFAULT_RANGE[k][1], w: "schoen" as Weight }];
    }),
  ) as Draft["ranges"];
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, c[k] ? { values: c[k]!.values, w: c[k]!.w } : { values: [], w: "schoen" as Weight }])) as Draft["lists"];
  return {
    ranges,
    lists,
    ort: { value: c.ort?.value ?? null, w: c.ort?.w ?? "schoen" },
    region: { stadt: c.region?.stadt ?? null, radius: c.region?.radius ?? 30, w: c.region?.w ?? "muss" },
  };
}

function toInput(d: Draft): CriteriaInput {
  const out: CriteriaInput = {};
  for (const k of RANGE_KEYS) {
    const r = d.ranges[k];
    if (r.on) out[k] = { min: r.min, max: r.max, w: r.w };
  }
  for (const k of LIST_KEYS) if (d.lists[k].values.length) out[k] = d.lists[k];
  if (d.ort.value) out.ort = { value: d.ort.value, w: d.ort.w };
  if (d.region.stadt) out.region = { stadt: d.region.stadt, radius: d.region.radius, w: d.region.w };
  return out;
}

const GROUPS: { title: string; ranges: (typeof RANGE_KEYS)[number][]; lists: EscortListKey[] }[] = [
  { title: "Person", ranges: ["alter"], lists: ["geschlecht", "nat", "sprachen"] },
  { title: "Figur & Aussehen", ranges: ["groesse", "gewicht"], lists: ["cup", "brust", "intim", "haare", "augen", "piercings", "tattoos"] },
  { title: "Stil & Grössen", ranges: [], lists: ["stil", "kleidung", "schuhe"] },
  { title: "Services & Preis", ranges: ["preis"], lists: ["services"] },
];

const UNITS: Record<(typeof RANGE_KEYS)[number], { unit: string; step?: number }> = {
  alter: { unit: "" },
  groesse: { unit: " cm" },
  gewicht: { unit: " kg" },
  preis: { unit: " CHF", step: 10 },
};

export function PreferencesForm({ initial, hasSaved }: { initial: Criteria; hasSaved: boolean }) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const router = useRouter();

  const setRange = (k: (typeof RANGE_KEYS)[number], patch: Partial<RangeDraft>) => setD({ ...d, ranges: { ...d.ranges, [k]: { ...d.ranges[k], ...patch } } });
  const setList = (k: EscortListKey, patch: Partial<ListDraft>) => setD({ ...d, lists: { ...d.lists, [k]: { ...d.lists[k], ...patch } } });

  const save = () =>
    start(async () => {
      const res = await savePreferences(toInput(d));
      if (res.ok) {
        toast.success(res.data.total ? `Präferenzen gespeichert (${res.data.total} Kriterien)` : "Präferenzen gespeichert", {
          action: { label: "Matches ansehen", onClick: () => router.push("/dashboard/matches") },
        });
        router.refresh();
      } else if (!handleLocked(res)) toast.error(res.error);
    });

  const reset = () =>
    start(async () => {
      const res = await resetPreferences();
      if (res.ok) {
        setD(toDraft({}));
        toast.success("Präferenzen gelöscht");
        router.refresh();
      } else if (!handleLocked(res)) toast.error(res.error);
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Deine Präferenzen sind privat: Sie werden verschlüsselt gespeichert, nie öffentlich angezeigt und nicht an Dritte weitergegeben. „Muss“-Kriterien
          filtern hart, „Wäre schön“-Kriterien erhöhen den Match-Score.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-bold">Region</h2>
        <CriterionRow label={CRITERION_LABELS.region} active={Boolean(d.region.stadt)} weight={d.region.w} onWeight={(w) => setD({ ...d, region: { ...d.region, w } })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              options={CITY_OPTIONS}
              value={d.region.stadt}
              onChange={(stadt) => setD({ ...d, region: { ...d.region, stadt } })}
              placeholder="Stadt wählen"
              searchable
              clearable
              sheetTitle="Stadt"
              aria-label="Stadt"
            />
            {d.region.stadt && (
              <SingleSlider label="Umkreis" min={1} max={200} value={d.region.radius} format={(n) => `${n} km`} onChange={(radius) => setD({ ...d, region: { ...d.region, radius } })} />
            )}
          </div>
        </CriterionRow>
      </section>

      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-bold">{g.title}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {g.ranges.map((k) => (
              <CriterionRow
                key={k}
                label={CRITERION_LABELS[k]}
                active={d.ranges[k].on}
                onActiveChange={(on) => setRange(k, { on })}
                weight={d.ranges[k].w}
                onWeight={(w) => setRange(k, { w })}
              >
                <RangeField
                  label="Bereich"
                  min={RANGES[k][0]}
                  max={RANGES[k][1]}
                  unit={UNITS[k].unit}
                  step={UNITS[k].step}
                  value={[d.ranges[k].min, d.ranges[k].max]}
                  onChange={(v) => setRange(k, { min: v?.[0] ?? RANGES[k][0], max: v?.[1] ?? RANGES[k][1] })}
                />
              </CriterionRow>
            ))}
            {g.lists.map((k) => {
              const o = listOptions(k);
              return (
                <CriterionRow key={k} label={CRITERION_LABELS[k]} active={d.lists[k].values.length > 0} weight={d.lists[k].w} onWeight={(w) => setList(k, { w })}>
                  <MultiSelect
                    options={o.options}
                    searchable={o.searchable}
                    value={d.lists[k].values}
                    onChange={(values) => setList(k, { values })}
                    placeholder="Egal"
                    clearable
                    sheetTitle={CRITERION_LABELS[k]}
                    aria-label={CRITERION_LABELS[k]}
                  />
                </CriterionRow>
              );
            })}
            {g.title === "Services & Preis" && (
              <CriterionRow label={CRITERION_LABELS.ort} active={Boolean(d.ort.value)} weight={d.ort.w} onWeight={(w) => setD({ ...d, ort: { ...d.ort, w } })}>
                <Field label="Wo möchtest du dich treffen?">
                  <Segmented
                    label="Treffpunkt"
                    value={d.ort.value ?? "egal"}
                    onChange={(v) => setD({ ...d, ort: { ...d.ort, value: v === "egal" ? null : v } })}
                    options={[
                      { value: "egal", label: "Egal" },
                      { value: "incall", label: "Incall" },
                      { value: "outcall", label: "Outcall" },
                    ]}
                  />
                </Field>
              </CriterionRow>
            )}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background py-3">
        <Button type="submit" disabled={pending}>
          Präferenzen speichern
        </Button>
        {hasSaved && (
          <Button type="button" variant="secondary" asChild>
            <Link href="/dashboard/matches">
              <Sparkles /> Meine Matches
            </Link>
          </Button>
        )}
        {hasSaved && (
          <Button type="button" variant="ghost" className="ml-auto" disabled={pending} onClick={reset}>
            Alle löschen
          </Button>
        )}
      </div>
    </form>
  );
}
