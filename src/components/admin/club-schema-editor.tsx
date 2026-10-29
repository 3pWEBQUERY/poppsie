"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClubFieldDef, ClubFieldRule } from "@/db/schema";
import { saveClubTypeSchema } from "@/lib/admin/actions/config";
import { cn } from "@/lib/utils";

type Schema = { clubType: string; label: string; fields: ClubFieldDef[]; updatedAt: string };

const INPUTS: { value: ClubFieldDef["input"]; label: string }[] = [
  { value: "text", label: "Text (einzeilig)" },
  { value: "textarea", label: "Text (mehrzeilig)" },
  { value: "number", label: "Zahl" },
  { value: "money", label: "Betrag (CHF)" },
  { value: "boolean", label: "Ja / Nein" },
  { value: "multiselect", label: "Mehrfachauswahl" },
  { value: "list", label: "Liste (Tarife)" },
  { value: "hours", label: "Zeiten" },
];

const RULES: { value: ClubFieldRule; label: string }[] = [
  { value: "required", label: "Pflicht" },
  { value: "optional", label: "Optional" },
  { value: "hidden", label: "Ausgeblendet" },
];

type Row = ClubFieldDef & { optionsText: string; uid: number };

let uid = 0;
const toRows = (fields: ClubFieldDef[]): Row[] => fields.map((f) => ({ ...f, optionsText: (f.options ?? []).join(", "), uid: ++uid }));

function SchemaForm({ schema }: { schema: Schema }) {
  const router = useRouter();
  const [label, setLabel] = useState(schema.label);
  const [rows, setRows] = useState<Row[]>(() => toRows(schema.fields));
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = () =>
    start(async () => {
      const fields = rows.map(({ key, label, input, rule, optionsText }) => ({
        key: key.trim(),
        label: label.trim(),
        input,
        rule,
        options: input === "multiselect" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      }));
      const res = await saveClubTypeSchema({ clubType: schema.clubType, label, fields });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Schema «${label}» gespeichert`);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`label-${schema.clubType}`}>Bezeichnung</Label>
          <Input id={`label-${schema.clubType}`} value={label} onChange={(e) => setLabel(e.target.value)} className="w-56" />
        </div>
        <p className="text-xs text-muted-foreground">
          Enum-Wert <code className="rounded bg-secondary px-1">{schema.clubType}</code> · zuletzt geändert {new Date(schema.updatedAt).toLocaleString("de-CH")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Feste Felder (Name, Logo, Cover, Beschreibung, Adresse, Karte, Öffnungszeiten, Line-up) sind nicht Teil des Schemas.
      </p>
      <ol className="flex flex-col gap-2">
        {rows.map((f, i) => (
          <li key={f.uid} className={cn("grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[140px_1fr_170px_auto_auto]", f.rule === "hidden" && "opacity-60")}>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Schlüssel</span>
              <Input value={f.key} onChange={(e) => update(i, { key: e.target.value })} className="h-8 font-mono text-xs" aria-label="Schlüssel" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Bezeichnung</span>
              <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} className="h-8" aria-label="Bezeichnung" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Eingabe</span>
              <Select aria-label="Eingabetyp" options={INPUTS} value={f.input} onChange={(v) => v && update(i, { input: v as ClubFieldDef["input"] })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Regel</span>
              <div role="radiogroup" aria-label="Regel" className="flex h-9 overflow-hidden rounded-md border">
                {RULES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={f.rule === r.value}
                    onClick={() => update(i, { rule: r.value })}
                    className={cn(
                      "px-2.5 text-xs transition-colors",
                      f.rule === r.value ? (r.value === "required" ? "bg-primary text-primary-foreground" : "bg-foreground text-background") : "hover:bg-accent",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Nach unten" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Feld entfernen" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
            {f.input === "multiselect" && (
              <div className="flex flex-col gap-1 md:col-span-5">
                <span className="text-[11px] text-muted-foreground">Optionen (kommagetrennt)</span>
                <Input value={f.optionsText} onChange={(e) => update(i, { optionsText: e.target.value })} className="h-8" placeholder="Sauna, Pool, Whirlpool" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRows((r) => [...r, { key: `feld${r.length + 1}`, label: "Neues Feld", input: "text", rule: "optional", optionsText: "", uid: ++uid }])}
        >
          <Plus /> Feld hinzufügen
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Speichern
        </Button>
      </div>
    </div>
  );
}

export function ClubSchemaEditor({ schemas }: { schemas: Schema[] }) {
  return (
    <Tabs defaultValue={schemas[0]?.clubType}>
      <TabsList>
        {schemas.map((s) => (
          <TabsTrigger key={s.clubType} value={s.clubType}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {schemas.map((s) => (
        <TabsContent key={s.clubType} value={s.clubType} className="rounded-lg border bg-card p-4">
          <SchemaForm schema={s} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
