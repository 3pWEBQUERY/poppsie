"use client";

import { useState, useTransition } from "react";
import { BarChart3, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/components/content/relative-time";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { votePoll } from "@/lib/forum/actions";
import type { PollView } from "@/lib/forum/types";
import { cn } from "@/lib/utils";

/** Umfrage (Einfach-/Mehrfachauswahl, optionales Enddatum); Ergebnisse nach Abstimmung oder Ende. */
export function PollBox({ poll: initial, canVote }: { poll: PollView; canVote: boolean }) {
  const [poll, setPoll] = useState(initial);
  const [picked, setPicked] = useState<string[]>(initial.mine);
  const [changing, setChanging] = useState(false);
  const [pending, start] = useTransition();
  const locked = useLockedHandler();
  const voted = poll.mine.length > 0;
  const showResults = poll.closed || !canVote || (voted && !changing);

  const toggle = (id: string) => setPicked((p) => (poll.multiple ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  const submit = () =>
    start(async () => {
      const res = await votePoll({ pollId: poll.id, optionIds: picked });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      setPoll(res.data);
      setChanging(false);
    });

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4" aria-label="Umfrage">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="font-bold">{poll.question}</h2>
          <p className="text-xs text-muted-foreground">
            {poll.multiple ? "Mehrfachauswahl" : "Einfachauswahl"} · {poll.voters} {poll.voters === 1 ? "Teilnehmer" : "Teilnehmende"}
            {poll.closesAt && ` · ${poll.closed ? "beendet am" : "endet am"} ${formatDateTime(poll.closesAt)}`}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {poll.options.map((o) => {
          const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
          const mine = poll.mine.includes(o.id);
          if (showResults)
            return (
              <li key={o.id} className="relative overflow-hidden rounded-md border px-3 py-2 text-sm">
                <span className={cn("absolute inset-y-0 left-0", mine ? "bg-primary/25" : "bg-secondary")} style={{ width: `${pct}%` }} aria-hidden />
                <span className="relative flex items-center gap-2">
                  {mine && <Check className="size-4 text-primary" aria-label="Deine Stimme" />}
                  <span className="flex-1">{o.label}</span>
                  <span className="text-xs font-semibold">{pct} %</span>
                  <span className="text-xs text-muted-foreground">({o.votes})</span>
                </span>
              </li>
            );
          const on = picked.includes(o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                role={poll.multiple ? "checkbox" : "radio"}
                aria-checked={on}
                onClick={() => toggle(o.id)}
                className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent", on && "border-primary")}
              >
                <span className={cn("flex size-4 items-center justify-center border", poll.multiple ? "rounded-sm" : "rounded-full", on && "border-primary bg-primary text-primary-foreground")}>
                  {on && <Check className="size-3" />}
                </span>
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
      {canVote && !poll.closed && (
        <div className="flex gap-2">
          {showResults ? (
            <Button size="sm" variant="outline" onClick={() => setChanging(true)}>
              Stimme ändern
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={pending || picked.length === 0}>
              {pending && <Loader2 className="animate-spin" />} Abstimmen
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
