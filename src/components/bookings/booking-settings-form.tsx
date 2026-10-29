"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NIGHT_MIN, durationLabel } from "@/lib/bookings/format";
import { saveBookingSettings } from "@/lib/bookings/settings-actions";
import type { BookingSettingsView } from "@/lib/bookings/types";

const BUFFER = [0, 15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: m === 0 ? "Kein Puffer" : `${m} min` }));
const LEAD = [
  [0, "Sofort buchbar"],
  [30, "30 min"],
  [60, "1 Stunde"],
  [120, "2 Stunden"],
  [240, "4 Stunden"],
  [720, "12 Stunden"],
  [1440, "1 Tag"],
  [2880, "2 Tage"],
].map(([v, l]) => ({ value: String(v), label: String(l) }));
const TIMEZONES = ["Europe/Zurich", "Europe/Berlin", "Europe/Vienna", "Europe/Paris", "Europe/Rome", "Europe/London"].map((t) => ({ value: t, label: t.replace("Europe/", "") }));
const STANDARD = [30, 60, 120, NIGHT_MIN];

/** Allgemeine Buchungseinstellungen der Escort. */
export function BookingSettingsForm({ initial, currency }: { initial: BookingSettingsView; currency: string }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const minutesList = [...new Set([...STANDARD, ...initial.durations.map((d) => d.minutes)])].sort((a, b) => a - b);
  const [prices, setPrices] = useState<Record<number, string>>(() => Object.fromEntries(minutesList.map((m) => [m, String(initial.durations.find((d) => d.minutes === m)?.price || "")])));
  const [active, setActive] = useState<Set<number>>(() => new Set(initial.durations.filter((d) => d.price > 0 || initial.enabled).map((d) => d.minutes)));

  const toggle = (m: number, on: boolean) =>
    setActive((cur) => {
      const n = new Set(cur);
      if (on) n.add(m);
      else n.delete(m);
      return n;
    });

  const save = () =>
    start(async () => {
      const durations = [...active].map((minutes) => ({ minutes, price: Math.max(0, Math.round(Number(prices[minutes] || 0))) }));
      const res = await saveBookingSettings({ ...s, durations });
      if (handleLocked(res)) return;
      if (!res.ok) toast.error(res.error);
      else toast.success("Einstellungen gespeichert");
    });

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center justify-between gap-4 rounded-md border bg-background px-4 py-3">
        <span>
          <span className="block font-semibold">Online-Buchung aktivieren</span>
          <span className="text-xs text-muted-foreground">Mitglieder sehen deine freien Termine und können anfragen.</span>
        </span>
        <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
          <span className="text-sm">Incall (bei dir)</span>
          <Switch checked={s.acceptsIncall} onCheckedChange={(v) => setS({ ...s, acceptsIncall: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
          <span className="text-sm">Outcall (Hotel/Wohnung)</span>
          <Switch checked={s.acceptsOutcall} onCheckedChange={(v) => setS({ ...s, acceptsOutcall: v })} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Puffer zwischen Terminen</Label>
          <Select options={BUFFER} value={String(s.bufferMin)} onChange={(v) => setS({ ...s, bufferMin: Number(v ?? 0) })} aria-label="Puffer" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Mindestvorlauf</Label>
          <Select options={LEAD} value={String(s.minLeadMin)} onChange={(v) => setS({ ...s, minLeadMin: Number(v ?? 0) })} aria-label="Mindestvorlauf" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Zeitzone</Label>
          <Select options={TIMEZONES} value={s.timezone} onChange={(v) => setS({ ...s, timezone: v ?? "Europe/Zurich" })} aria-label="Zeitzone" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Buchbare Dauern und Preise ({currency})</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {minutesList.map((m) => (
            <div key={m} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Checkbox id={`dur-${m}`} checked={active.has(m)} onCheckedChange={(v) => toggle(m, v === true)} />
              <label htmlFor={`dur-${m}`} className="w-16 text-sm font-medium">
                {durationLabel(m)}
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={prices[m] ?? ""}
                onChange={(e) => setPrices({ ...prices, [m]: e.target.value })}
                placeholder="Preis"
                className="h-8"
                disabled={!active.has(m)}
                aria-label={`Preis für ${durationLabel(m)}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Vorbelegt mit den Preisen aus deinem Profil. „Nacht“ = 12 Stunden.</p>
      </div>

      <Button onClick={save} disabled={pending} className="self-start">
        Einstellungen speichern
      </Button>
    </div>
  );
}
