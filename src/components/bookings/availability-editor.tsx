"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/bookings/format";
import { saveAvailabilityRules } from "@/lib/bookings/settings-actions";
import type { Rule } from "@/lib/bookings/slots";
import { timeOptions } from "./time-options";

const TIMES = timeOptions(30);
const PRESETS: { label: string; rules: Rule[] }[] = [
  { label: "Mo–Fr 14–22 Uhr", rules: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 840, endMin: 1320 })) },
  { label: "Täglich 10–22 Uhr", rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 1320 })) },
  { label: "Abends 18–24 Uhr", rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 1080, endMin: 1440 })) },
];

/** Wiederkehrende Verfügbarkeit pro Wochentag (mehrere Zeitfenster möglich). */
export function AvailabilityEditor({ initial }: { initial: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(initial.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })));
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();

  const update = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const copyToAll = (weekday: number) => {
    const src = rules.filter((r) => r.weekday === weekday);
    setRules([0, 1, 2, 3, 4, 5, 6].flatMap((wd) => src.map((r) => ({ ...r, weekday: wd }))));
  };

  const save = () =>
    start(async () => {
      const res = await saveAvailabilityRules(rules);
      if (handleLocked(res)) return;
      if (!res.ok) toast.error(res.error);
      else toast.success("Verfügbarkeit gespeichert");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-muted-foreground">Vorlage:</span>
        {PRESETS.map((p) => (
          <Button key={p.label} type="button" size="sm" variant="secondary" onClick={() => setRules(p.rules)}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-col divide-y rounded-md border">
        {WEEKDAYS.map((label, wd) => {
          const own = rules.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
          return (
            <div key={wd} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-1.5 text-sm font-semibold">{label}</span>
              <div className="flex flex-1 flex-col gap-2">
                {own.length === 0 && <span className="pt-1.5 text-sm text-muted-foreground">Nicht verfügbar</span>}
                {own.map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select className="w-28" options={TIMES.slice(0, -1)} value={String(r.startMin)} onChange={(v) => update(i, { startMin: Number(v ?? 0) })} aria-label={`${label} von`} />
                    <span className="text-muted-foreground">–</span>
                    <Select className="w-28" options={TIMES.slice(1)} value={String(r.endMin)} onChange={(v) => update(i, { endMin: Number(v ?? 1440) })} aria-label={`${label} bis`} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Zeitfenster entfernen" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setRules([...rules, { weekday: wd, startMin: 840, endMin: 1320 }])}>
                  <Plus /> Zeit
                </Button>
                {own.length > 0 && (
                  <Button type="button" variant="ghost" size="icon-sm" title="Auf alle Tage übertragen" aria-label="Auf alle Tage übertragen" onClick={() => copyToAll(wd)}>
                    <Copy />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={save} disabled={pending} className="self-start">
        Verfügbarkeit speichern
      </Button>
    </div>
  );
}
