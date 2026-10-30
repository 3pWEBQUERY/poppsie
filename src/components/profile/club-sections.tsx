import Link from "next/link";
import { BadgeCheck, Check, Minus, Sparkles } from "lucide-react";
import type { ClubFieldDef } from "@/db/schema";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { LineupEntry } from "@/lib/profiles/club-public";
import { formatPrice } from "@/lib/utils";
import { ChipList, FactsList, type Fact } from "./profile-parts";

/** Line-up-Raster: verknüpfte Girls, "Heute anwesend" hervorgehoben. */
export function Lineup({ entries }: { entries: LineupEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Noch keine Girls im Line-up.</p>;
  const today = entries.filter((e) => e.presentToday).length;
  return (
    <div className="flex flex-col gap-3">
      {today > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <Sparkles className="size-3.5" /> {today} {today === 1 ? "Girl ist" : "Girls sind"} heute anwesend
        </p>
      )}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {entries.map((e) => (
          <li key={e.id}>
            <Link href={e.href} className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center transition-colors hover:border-foreground/40">
              <UserAvatar user={{ name: e.name, avatarUrl: e.avatarUrl }} size="lg" ring={e.hasStory ? "story" : undefined} />
              <span className="flex max-w-full items-center gap-1 text-xs font-semibold">
                <span className="truncate">{e.name}</span>
                {e.age && <span className="font-normal text-muted-foreground">{e.age}</span>}
                {e.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
              </span>
              {e.presentToday ? (
                <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-white">Heute anwesend</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Im Line-up</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatValue(f: ClubFieldDef, v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  switch (f.input) {
    case "money":
      return typeof v === "number" ? formatPrice(v) : String(v);
    case "boolean":
      return v ? (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="size-3.5" /> Ja
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Minus className="size-3.5" /> Nein
        </span>
      );
    case "multiselect":
    case "list":
      return Array.isArray(v) ? (v as string[]).join(", ") : String(v);
    default:
      return String(v);
  }
}

const PRICE_KEYS = new Set(["entryPrice", "roomRates"]);

/** Preise (Eintritt, Tarife) aus den dynamischen Feldern. */
export function ClubPrices({ fields, data }: { fields: ClubFieldDef[]; data: Record<string, unknown> }) {
  const entry = fields.find((f) => f.key === "entryPrice");
  const rates = fields.find((f) => f.key === "roomRates");
  const entryVal = entry ? data.entryPrice : undefined;
  const ratesVal = rates && Array.isArray(data.roomRates) ? (data.roomRates as string[]) : [];
  if ((entryVal === undefined || entryVal === null) && ratesVal.length === 0) return <p className="text-xs text-muted-foreground">Preise auf Anfrage.</p>;
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      {entry && entryVal != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Eintritt</span>
          <span className="font-semibold">{formatValue(entry, entryVal)}</span>
        </div>
      )}
      {ratesVal.length > 0 && (
        <ul className="divide-y">
          {ratesVal.map((r, i) => (
            <li key={i} className="py-1.5">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Übrige dynamische Felder als Steckbrief; Textfelder und Mehrfachauswahlen gesondert. */
export function ClubDetails({ fields, data }: { fields: ClubFieldDef[]; data: Record<string, unknown> }) {
  const rest = fields.filter((f) => !PRICE_KEYS.has(f.key));
  const facts: Fact[] = rest.filter((f) => f.input !== "textarea" && f.input !== "multiselect").map((f) => ({ label: f.label, value: formatValue(f, data[f.key]) }));
  const multi = rest.filter((f) => f.input === "multiselect" && Array.isArray(data[f.key]) && (data[f.key] as unknown[]).length);
  const texts = rest.filter((f) => f.input === "textarea" && typeof data[f.key] === "string" && data[f.key]);
  return (
    <div className="flex flex-col gap-4">
      <FactsList facts={facts} />
      {multi.map((f) => (
        <div key={f.key}>
          <p className="mb-1.5 text-xs text-muted-foreground">{f.label}</p>
          <ChipList items={data[f.key] as string[]} icon={false} />
        </div>
      ))}
      {texts.map((f) => (
        <div key={f.key}>
          <p className="mb-1 text-xs text-muted-foreground">{f.label}</p>
          <p className="text-[13px] whitespace-pre-line">{String(data[f.key])}</p>
        </div>
      ))}
    </div>
  );
}
