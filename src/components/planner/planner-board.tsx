"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clapperboard, MapPin, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WEEKDAYS_SHORT, addDays, localMinutes, minutesLabel, mondayOf } from "@/lib/bookings/format";
import { deleteScheduled } from "@/lib/planner/actions";
import { SEGMENT_LABEL, STATUS_LABEL, TYPE_LABEL, type PlannerItem, type PlannerType } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { PlannerForm } from "./planner-form";

const ICON: Record<PlannerType, React.ReactNode> = { story: <Clapperboard />, location: <MapPin />, broadcast: <Megaphone /> };
const STATUS_VARIANT = { scheduled: "warning", running: "secondary", done: "success", failed: "default", cancelled: "muted" } as const;

function fmtDay(d: string) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
}

function summary(i: PlannerItem) {
  const p = i.payload as Record<string, string | undefined>;
  if (i.type === "story") return p.overlayText ? `„${p.overlayText}“` : "Story mit Medium";
  if (i.type === "location") return `Standort: ${p.city}`;
  return `${SEGMENT_LABEL[p.segment as keyof typeof SEGMENT_LABEL] ?? "Follower"}${p.region ? ` (${p.region})` : ""}: ${p.text ?? ""}`;
}

/** Planer: Monatskalender und Liste mit Bearbeiten/Löschen bis zur Ausführung. */
export function PlannerBoard({ items, timezone, today, canLocation }: { items: PlannerItem[]; timezone: string; today: string; canLocation: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ item?: PlannerItem; date: string; minutes: number } | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [pending, start] = useTransition();

  const byDate = useMemo(() => {
    const m = new Map<string, PlannerItem[]>();
    for (const i of items) m.set(i.localDate, [...(m.get(i.localDate) ?? []), i]);
    return m;
  }, [items]);

  const upcoming = items.filter((i) => i.status === "scheduled" || i.status === "running");
  const history = items.filter((i) => !upcoming.includes(i)).reverse();

  const remove = (i: PlannerItem) =>
    start(async () => {
      const res = await deleteScheduled(i.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Gelöscht");
      router.refresh();
    });

  const openNew = (date = today) => setDialog({ date, minutes: date === today ? Math.min(1425, Math.ceil((localMinutes(new Date(), timezone) + 30) / 15) * 15) : 600 });

  // Monatsraster ab Montag
  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const days = Array.from({ length: 42 }, (_, k) => addDays(gridStart, k));
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  const row = (i: PlannerItem) => (
    <li key={i.id} className="flex items-start gap-3 px-3 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-4">{ICON[i.type]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{TYPE_LABEL[i.type]}</span>
          <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {fmtDay(i.localDate)}, {minutesLabel(i.localMin)} Uhr
          {i.executedAt && i.status === "done" && ` · ausgeführt ${new Intl.DateTimeFormat("de-CH", { timeStyle: "short", dateStyle: "short", timeZone: timezone }).format(new Date(i.executedAt))}`}
        </div>
        <p className="mt-1 line-clamp-2 text-sm">{summary(i)}</p>
        {i.lastError && (
          <p className="mt-1 text-xs text-destructive">
            {i.status === "failed" ? "Fehler" : `Versuch ${i.attempts} fehlgeschlagen, neuer Versuch geplant`}: {i.lastError}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {i.status === "scheduled" && (
          <Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" onClick={() => setDialog({ item: i, date: i.localDate, minutes: i.localMin })}>
            <Pencil />
          </Button>
        )}
        {i.status !== "running" && (
          <Button variant="ghost" size="icon-sm" aria-label="Löschen" disabled={pending} onClick={() => remove(i)}>
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => openNew()}>
          <Plus /> Aktion planen
        </Button>
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-3 flex flex-col gap-4">
          <section className="rounded-lg border bg-card">
            <h2 className="border-b px-4 py-3 font-bold">Geplant ({upcoming.length})</h2>
            {upcoming.length ? <ul className="divide-y">{upcoming.map(row)}</ul> : <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nichts geplant. Plane Stories, Tourstopps oder Nachrichten im Voraus.</p>}
          </section>
          {history.length > 0 && (
            <section className="rounded-lg border bg-card">
              <h2 className="border-b px-4 py-3 font-bold">Verlauf</h2>
              <ul className="divide-y">{history.slice(0, 50).map(row)}</ul>
            </section>
          )}
        </TabsContent>
        <TabsContent value="calendar" className="mt-3">
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
                <ChevronLeft />
              </Button>
              <span className="font-semibold">{new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`))}</span>
              <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
                <ChevronRight />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
              {WEEKDAYS_SHORT.map((d) => (
                <div key={d} className="bg-card py-1.5 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const list = byDate.get(d) ?? [];
                const inMonth = d.startsWith(month);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={d < today}
                    onClick={() => openNew(d)}
                    className={cn("flex min-h-20 flex-col gap-1 bg-card p-1.5 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-card", !inMonth && "opacity-40")}
                    aria-label={`${fmtDay(d)}: ${list.length} Aktionen`}
                  >
                    <span className={cn("text-xs tabular-nums", d === today && "flex size-5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground")}>{Number(d.slice(8, 10))}</span>
                    {list.slice(0, 3).map((i) => (
                      <span key={i.id} className={cn("flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] [&_svg]:size-3", i.status === "failed" ? "bg-destructive/20" : i.status === "done" ? "bg-secondary" : "bg-primary/20")}>
                        {ICON[i.type]} {minutesLabel(i.localMin)}
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{list.length - 3}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Tippe auf einen Tag, um dort eine Aktion zu planen.</p>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.item ? "Aktion bearbeiten" : "Aktion planen"}</DialogTitle>
            <DialogDescription>Wird automatisch zur gewählten Zeit ausgeführt (innerhalb einer Minute).</DialogDescription>
          </DialogHeader>
          {dialog && (
            <PlannerForm
              key={dialog.item?.id ?? dialog.date}
              initial={dialog}
              timezone={timezone}
              canLocation={canLocation}
              onCancel={() => setDialog(null)}
              onDone={() => {
                setDialog(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
