"use client";

import { useEffect, useMemo, useState } from "react";
import { Apple, Car, Clock, Dog, Flag as FlagIcon, Heart, Lightbulb, Smile, SmilePlus, Trophy, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Emoji = { unicode: string; label: string; group?: number; tags?: string[]; skins?: { unicode: string }[] };

const GROUPS = [
  { id: -1, label: "Zuletzt verwendet", icon: Clock },
  { id: 0, label: "Smileys & Emotionen", icon: Smile },
  { id: 1, label: "Menschen & Körper", icon: User },
  { id: 3, label: "Tiere & Natur", icon: Dog },
  { id: 4, label: "Essen & Trinken", icon: Apple },
  { id: 5, label: "Reisen & Orte", icon: Car },
  { id: 6, label: "Aktivitäten", icon: Trophy },
  { id: 7, label: "Objekte", icon: Lightbulb },
  { id: 8, label: "Symbole", icon: Heart },
  { id: 9, label: "Flaggen", icon: FlagIcon },
];
const TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
const RECENT_KEY = "pp:emoji-recent";
const TONE_KEY = "pp:emoji-tone";

let cache: Emoji[] | null = null;
async function loadEmojis() {
  if (!cache) cache = ((await import("emojibase-data/de/compact.json")).default as Emoji[]).filter((e) => e.group !== undefined && e.group !== 2);
  return cache;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Gemeinsamer Emoji-Picker (Messenger, Feed, Forum, Gruppen, Stories).
 * Gespeichert wird immer der Unicode-Text; dargestellt werden die nativen Emojis der Plattform
 * (auf Apple-Geräten Apple Color Emoji, lizenzrechtlich unbedenklich).
 */
export function EmojiPicker({ onSelect, className, triggerClassName }: { onSelect: (emoji: string) => void; className?: string; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Emoji einfügen"
        className={cn("inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", triggerClassName)}
      >
        <SmilePlus className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("w-[330px] p-0", className)}>
        {open && <EmojiPanel onSelect={onSelect} />}
      </PopoverContent>
    </Popover>
  );
}

export function EmojiPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [all, setAll] = useState<Emoji[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(0);
  const [tone, setTone] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    loadEmojis().then(setAll);
    setRecent(readLocal<string[]>(RECENT_KEY, []));
    setTone(readLocal<number>(TONE_KEY, 0));
  }, []);

  const withTone = (e: Emoji) => (tone > 0 && e.skins?.[tone - 1] ? e.skins[tone - 1]!.unicode : e.unicode);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return all.filter((e) => e.label.toLowerCase().includes(q) || e.tags?.some((t) => t.toLowerCase().includes(q))).slice(0, 240);
    if (group === -1) return recent.map((u) => all.find((e) => e.unicode === u || e.skins?.some((s) => s.unicode === u)) ?? { unicode: u, label: u });
    return all.filter((e) => e.group === group);
  }, [all, query, group, recent]);

  const pick = (e: Emoji) => {
    const u = group === -1 && !query ? e.unicode : withTone(e);
    onSelect(u);
    const next = [u, ...recent.filter((r) => r !== u)].slice(0, 32);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Emoji suchen …"
          aria-label="Emoji suchen"
          className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring"
        />
        <div className="flex items-center" role="radiogroup" aria-label="Hautton">
          {TONES.map((t, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={tone === i}
              aria-label={`Hautton ${i}`}
              onClick={() => {
                setTone(i);
                try {
                  localStorage.setItem(TONE_KEY, String(i));
                } catch {}
              }}
              className={cn("rounded px-0.5 text-sm", tone === i ? "bg-accent" : "opacity-60 hover:opacity-100")}
            >
              {`👋${t}`}
            </button>
          ))}
        </div>
      </div>
      {!query && (
        <div className="flex justify-between border-b px-1 py-1" role="tablist" aria-label="Kategorien">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={group === g.id}
              title={g.label}
              aria-label={g.label}
              onClick={() => setGroup(g.id)}
              className={cn("rounded-md p-1.5 text-muted-foreground hover:text-foreground", group === g.id && "bg-accent text-foreground")}
            >
              <g.icon className="size-4" />
            </button>
          ))}
        </div>
      )}
      <div className="grid h-64 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {list.length === 0 && <p className="col-span-8 py-8 text-center text-xs text-muted-foreground">{group === -1 ? "Noch keine Emojis verwendet" : "Keine Treffer"}</p>}
        {list.map((e) => (
          <button
            key={e.unicode}
            type="button"
            title={e.label}
            aria-label={e.label}
            onClick={() => pick(e)}
            className="flex aspect-square items-center justify-center rounded-md text-2xl leading-none hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            {group === -1 && !query ? e.unicode : withTone(e)}
          </button>
        ))}
      </div>
    </div>
  );
}
