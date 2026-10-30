"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { minutesLabel } from "@/lib/bookings/format";
import { addAvailabilityException, deleteAvailabilityException } from "@/lib/bookings/settings-actions";
import { timeOptions } from "./time-options";

type Exc = { id: string; dateFrom: string; dateTo: string; kind: string; startMin: number | null; endMin: number | null; note: string | null };

const KINDS = [
  { value: "unavailable", label: "Abwesend / Ferien" },
  { value: "extra", label: "Zusätzlich verfügbar" },
];
const TIMES = timeOptions(30);

function fmt(d: string) {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

/** Ausnahmen: Ferien/Abwesenheit oder Zusatzzeiten. */
export function ExceptionsEditor({ initial, today }: { initial: Exc[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const [kind, setKind] = useState("unavailable");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [partial, setPartial] = useState(false);
  const [startMin, setStartMin] = useState(840);
  const [endMin, setEndMin] = useState(1320);
  const [note, setNote] = useState("");
  const timed = kind === "extra" || partial;

  const add = () =>
    start(async () => {
      const res = await addAvailabilityException({
        kind: kind as "unavailable" | "extra",
        dateFrom: from,
        dateTo: to < from ? from : to,
        startMin: timed ? startMin : null,
        endMin: timed ? endMin : null,
        note: note || undefined,
      });
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success("Ausnahme gespeichert");
      setNote("");
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteAvailabilityException(id);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {initial.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-md border">
          {initial.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Badge variant={e.kind === "extra" ? "success" : "muted"}>{e.kind === "extra" ? "Zusatzzeit" : "Abwesend"}</Badge>
              <span className="flex-1">
                {fmt(e.dateFrom)}
                {e.dateTo !== e.dateFrom && ` – ${fmt(e.dateTo)}`}
                {e.startMin !== null && e.endMin !== null && `, ${minutesLabel(e.startMin)}–${minutesLabel(e.endMin)} Uhr`}
                {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Ausnahme löschen" disabled={pending} onClick={() => remove(e.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Keine Ausnahmen geplant.</p>
      )}

      <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Art</Label>
          <Select options={KINDS} value={kind} onChange={(v) => setKind(v ?? "unavailable")} aria-label="Art der Ausnahme" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="exc-from">Von</Label>
          <Input id="exc-from" type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="exc-to">Bis</Label>
          <Input id="exc-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        {kind === "unavailable" && (
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <Switch checked={partial} onCheckedChange={setPartial} /> Nur einige Stunden (sonst ganztägig)
          </label>
        )}
        {timed && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <Select className="w-28" options={TIMES.slice(0, -1)} value={String(startMin)} onChange={(v) => setStartMin(Number(v ?? 0))} aria-label="Beginn" />
            <span className="text-muted-foreground">–</span>
            <Select className="w-28" options={TIMES.slice(1)} value={String(endMin)} onChange={(v) => setEndMin(Number(v ?? 1440))} aria-label="Ende" />
          </div>
        )}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="exc-note">Notiz (nur für dich)</Label>
          <Input id="exc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="z. B. Ferien Tessin" />
        </div>
        <Button onClick={add} disabled={pending} className="self-start" variant="secondary">
          <Plus /> Ausnahme hinzufügen
        </Button>
      </div>
    </div>
  );
}
