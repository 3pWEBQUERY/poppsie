import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { allCategories, readableCategoryIds, type Category } from "./access";
import { categoryTree } from "./queries";
import type { ThreadSort } from "./types";

/** Kategorien, lesbare IDs und Baum für Sidebar und Seiten. */
export async function forumBase(viewer: SessionUser | null) {
  const [cats, readable] = await Promise.all([allCategories(), readableCategoryIds(viewer)]);
  const readSet = new Set(readable);
  const tree = await categoryTree(cats, readSet);
  return { cats, readable, readSet, tree };
}

export function parseSort(v: unknown): ThreadSort {
  return v === "neu" || v === "top" ? v : "aktivitaet";
}

export function parsePage(v: unknown) {
  const n = Number(typeof v === "string" ? v : 1);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 1000) : 1;
}

/** Kategorie samt Unterforen (für Listen in einer Oberkategorie). */
export function withChildren(cat: Category, cats: Category[]) {
  return [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)];
}
