"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCategoryModerator, deleteForumCategory, removeCategoryModerator } from "@/lib/admin/actions/config";
import { cn } from "@/lib/utils";
import { ForumCategoryDialog, type CategoryValue } from "./forum-category-dialog";

export type ForumCategoryRow = CategoryValue & { id: string; threadCount: number; moderators: { id: string; username: string }[] };

const TYPE_SHORT = { member: "Mitglieder", escort: "Escorts", club: "Clubs" } as const;

const blank = (parentId: string | null, sortOrder: number): CategoryValue => ({
  parentId,
  name: "",
  slug: "",
  description: "",
  sortOrder,
  readTypes: [],
  writeTypes: [],
  adultOnlyMedia: false,
});

function Rights({ label, types }: { label: string; types: string[] }) {
  return (
    <span className="text-[11px] text-muted-foreground">
      {label}: {types.length ? types.map((t) => TYPE_SHORT[t as keyof typeof TYPE_SHORT] ?? t).join(", ") : "alle"}
    </span>
  );
}

function Moderators({ cat }: { cat: ForumCategoryRow }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const refresh = (res: { ok: boolean; error?: string }, msg: string) => {
    if (!res.ok) toast.error(res.error ?? "Fehler");
    else {
      toast.success(msg);
      router.refresh();
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {cat.moderators.map((m) => (
        <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
          @{m.username}
          <button
            type="button"
            aria-label={`@${m.username} als Moderator entfernen`}
            disabled={pending}
            className="rounded-full p-0.5 hover:bg-background"
            onClick={() => start(async () => refresh(await removeCategoryModerator({ categoryId: cat.id, userId: m.id }), "Moderator entfernt"))}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => {
            const res = await addCategoryModerator({ categoryId: cat.id, username: name });
            refresh(res, "Moderator hinzugefügt");
            if (res.ok) setName("");
          });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Benutzername" aria-label="Moderator hinzufügen" className="h-7 w-32 text-xs" />
        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Moderator hinzufügen" disabled={pending} className="size-7">
          <UserPlus />
        </Button>
      </form>
    </div>
  );
}

function CategoryItem({ cat, parents, childCount, sub }: { cat: ForumCategoryRow; parents: { id: string; name: string }[]; childCount: number; sub?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-col gap-2 p-3 md:flex-row md:items-start", sub && "pl-8")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          {sub && <CornerDownRight className="size-3.5 text-muted-foreground" />}
          <span className="font-semibold">{cat.name}</span>
          <code className="text-[11px] text-muted-foreground">/{cat.slug}</code>
          {cat.adultOnlyMedia && <Badge variant="warning">18+ Medien</Badge>}
          <span className="text-[11px] text-muted-foreground">{cat.threadCount} Threads</span>
        </p>
        {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
        <p className="flex flex-wrap gap-3">
          <Rights label="Lesen" types={cat.readTypes} />
          <Rights label="Schreiben" types={cat.writeTypes} />
          <span className="text-[11px] text-muted-foreground">Reihenfolge {cat.sortOrder}</span>
        </p>
        <Moderators cat={cat} />
      </div>
      <div className="flex shrink-0 gap-1">
        {!sub && (
          <ForumCategoryDialog
            trigger={
              <Button size="sm" variant="ghost">
                <Plus /> Unterforum
              </Button>
            }
            initial={blank(cat.id, childCount * 10)}
            parents={parents}
          />
        )}
        <ForumCategoryDialog
          trigger={
            <Button size="icon-sm" variant="ghost" aria-label={`${cat.name} bearbeiten`}>
              <Pencil />
            </Button>
          }
          initial={cat}
          parents={parents}
          hasChildren={childCount > 0}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`${cat.name} löschen`}
          disabled={pending}
          onClick={() => {
            const warn = cat.threadCount ? ` Dabei werden ${cat.threadCount} Threads mit allen Beiträgen gelöscht.` : "";
            if (!window.confirm(`Kategorie «${cat.name}» wirklich löschen?${warn}`)) return;
            start(async () => {
              const res = await deleteForumCategory(cat.id);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Kategorie gelöscht");
                router.refresh();
              }
            });
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

export function ForumAdmin({ categories }: { categories: ForumCategoryRow[] }) {
  const roots = categories.filter((c) => !c.parentId);
  const parents = roots.map((r) => ({ id: r.id, name: r.name }));
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const orphans = categories.filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId));
  return (
    <div className="flex flex-col gap-3">
      <div>
        <ForumCategoryDialog
          trigger={
            <Button>
              <Plus /> Neue Kategorie
            </Button>
          }
          initial={blank(null, roots.length * 10)}
          parents={parents}
        />
      </div>
      {roots.length === 0 && <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Forum-Kategorien.</p>}
      {roots.map((r) => {
        const kids = childrenOf(r.id);
        return (
          <div key={r.id} className="divide-y rounded-lg border bg-card">
            <CategoryItem cat={r} parents={parents} childCount={kids.length} />
            {kids.map((k) => (
              <CategoryItem key={k.id} cat={k} parents={parents} childCount={0} sub />
            ))}
          </div>
        );
      })}
      {orphans.length > 0 && (
        <div className="divide-y rounded-lg border border-warning/50 bg-card">
          <p className="px-3 py-2 text-xs text-warning">Unterforen ohne gültige Oberkategorie</p>
          {orphans.map((k) => (
            <CategoryItem key={k.id} cat={k} parents={parents} childCount={0} sub />
          ))}
        </div>
      )}
    </div>
  );
}
