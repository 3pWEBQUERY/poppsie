"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Plus, X } from "lucide-react";
import { Composer } from "@/components/content/composer";
import { Select, type SelectOption } from "@/components/shared/select/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createThread } from "@/lib/forum/actions";
import { THREAD_PREFIXES } from "@/lib/forum/types";

/** Neues Thema: Kategorie, Präfix, Titel, Tags, Beitrag und optionale Umfrage. */
export function NewThreadForm({ categories, initialCategory, groupMode }: { categories: SelectOption[]; initialCategory: string | null; groupMode?: boolean }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [pollOn, setPollOn] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        {!groupMode && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Kategorie</Label>
            <Select options={categories} value={categoryId} onChange={setCategoryId} placeholder="Unterforum wählen" searchable aria-label="Kategorie" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Präfix (optional)</Label>
          <Select options={THREAD_PREFIXES.map((p) => ({ value: p, label: p }))} value={prefix} onChange={setPrefix} clearable placeholder="Kein Präfix" aria-label="Präfix" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nt-tags">Tags (mit Komma getrennt)</Label>
          <Input id="nt-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="z. B. zürich, tipps" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="nt-title">Titel</Label>
          <Input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Worum geht es?" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch checked={pollOn} onCheckedChange={setPollOn} />
          <BarChart3 className="size-4 text-primary" /> Umfrage hinzufügen
        </label>
        {pollOn && (
          <div className="flex flex-col gap-3">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Frage" aria-label="Frage" maxLength={200} />
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} onChange={(e) => setOptions((l) => l.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Antwort ${i + 1}`} aria-label={`Antwort ${i + 1}`} maxLength={100} />
                {options.length > 2 && (
                  <button type="button" aria-label="Antwort entfernen" onClick={() => setOptions((l) => l.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button type="button" onClick={() => setOptions((l) => [...l, ""])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="size-3.5" /> Antwort hinzufügen
              </button>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={multiple} onCheckedChange={setMultiple} /> Mehrfachauswahl
              </label>
              <label className="flex items-center gap-2 text-sm">
                Endet am
                <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="h-8 w-auto" aria-label="Enddatum (optional)" />
              </label>
            </div>
          </div>
        )}
      </div>

      <Composer
        context="forum"
        placeholder="Dein Beitrag …"
        submitLabel="Thema erstellen"
        storageKey={`new-thread:${categoryId ?? "x"}`}
        onSubmit={async (p) => {
          const res = await createThread({
            categoryId: categoryId ?? "",
            title,
            prefix: (prefix as (typeof THREAD_PREFIXES)[number]) || null,
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            body: p.body,
            mediaIds: p.mediaIds,
            embeds: p.embeds,
            poll: pollOn ? { question, options: options.map((o) => o.trim()).filter(Boolean), multiple, closesAt: closesAt ? new Date(closesAt).toISOString() : null } : null,
          });
          if (res.ok) router.push(`/forum/thread/${res.data.id}`);
          return res;
        }}
      />
    </div>
  );
}
