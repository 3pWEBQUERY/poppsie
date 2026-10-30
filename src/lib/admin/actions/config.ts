"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clubTypeSchemas, forumCategories, forumCategoryModerators, forumThreads, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { writeLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";

const STAFF = { roles: ["admin", "moderator"] as ("admin" | "moderator")[] };

const invalid = (e: z.ZodError) => new ApiError("INVALID", e.issues[0] ? `${e.issues[0].path.join(".") || "Eingabe"}: ${e.issues[0].message}` : "Ungültige Eingabe");

const FieldDef = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9]{1,39}$/, "Schlüssel: Buchstaben/Ziffern, beginnt mit Buchstabe"),
  label: z.string().trim().min(1, "Bezeichnung fehlt").max(80),
  input: z.enum(["text", "textarea", "number", "money", "boolean", "multiselect", "hours", "list"]),
  rule: z.enum(["required", "optional", "hidden"]),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

const SchemaInput = z.object({
  clubType: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(60),
  fields: z.array(FieldDef).max(60),
});

/** Felddefinitionen eines Club-Typs speichern (neue Typen brauchen eine Enum-Migration). */
export async function saveClubTypeSchema(input: z.input<typeof SchemaInput>) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.clubtype", 30);
    const parsed = SchemaInput.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    const d = parsed.data;
    const keys = new Set<string>();
    for (const f of d.fields) {
      if (keys.has(f.key)) throw new ApiError("INVALID", `Schlüssel «${f.key}» ist doppelt`);
      keys.add(f.key);
      if (f.input === "multiselect" && !f.options?.length) throw new ApiError("INVALID", `«${f.label}»: Mehrfachauswahl braucht Optionen`);
    }
    const fields = d.fields.map((f) => ({ ...f, options: f.input === "multiselect" ? f.options : undefined }));
    const [before] = await db.select().from(clubTypeSchemas).where(eq(clubTypeSchemas.clubType, d.clubType));
    if (!before) throw new ApiError("NOT_FOUND", "Club-Typ nicht gefunden");
    await db.update(clubTypeSchemas).set({ label: d.label, fields, updatedAt: new Date() }).where(eq(clubTypeSchemas.clubType, d.clubType));
    await audit(staff.id, "config.club_type_schema", { type: "club_type", id: d.clubType }, { before: { label: before.label, fields: before.fields }, after: { label: d.label, fields } });
    revalidatePath("/admin/club-typen");
    return { ok: true };
  });
}

const ACCOUNT_TYPES = z.array(z.enum(["member", "escort", "club"])).max(3);

const CategoryInput = z.object({
  id: z.uuid().optional(),
  parentId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2, "Name zu kurz").max(80),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  readTypes: ACCOUNT_TYPES.default([]),
  writeTypes: ACCOUNT_TYPES.default([]),
  adultOnlyMedia: z.boolean().default(false),
});

export async function saveForumCategory(input: z.input<typeof CategoryInput>) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.forum", 60);
    const parsed = CategoryInput.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    const d = parsed.data;
    const slug = slugify(d.slug || d.name);
    if (!slug) throw new ApiError("INVALID", "Ungültiger Slug");
    const [dupe] = await db
      .select({ id: forumCategories.id })
      .from(forumCategories)
      .where(d.id ? and(eq(forumCategories.slug, slug), ne(forumCategories.id, d.id)) : eq(forumCategories.slug, slug));
    if (dupe) throw new ApiError("CONFLICT", `Der Slug «${slug}» ist schon vergeben`);
    if (d.parentId) {
      if (d.parentId === d.id) throw new ApiError("INVALID", "Eine Kategorie kann nicht ihr eigenes Unterforum sein");
      const [parent] = await db.select({ parentId: forumCategories.parentId, groupId: forumCategories.groupId }).from(forumCategories).where(eq(forumCategories.id, d.parentId));
      if (!parent || parent.groupId) throw new ApiError("INVALID", "Oberkategorie nicht gefunden");
      if (parent.parentId) throw new ApiError("INVALID", "Unterforen können nur unter einer Hauptkategorie liegen");
      if (d.id) {
        const [kids] = await db.select({ n: count() }).from(forumCategories).where(eq(forumCategories.parentId, d.id));
        if (kids?.n) throw new ApiError("INVALID", "Kategorien mit Unterforen können nicht verschoben werden");
      }
    }
    const values = {
      parentId: d.parentId ?? null,
      name: d.name,
      slug,
      description: d.description || null,
      sortOrder: d.sortOrder,
      readTypes: d.readTypes,
      writeTypes: d.writeTypes,
      adultOnlyMedia: d.adultOnlyMedia,
    };
    let id = d.id;
    if (d.id) {
      const res = await db.update(forumCategories).set(values).where(and(eq(forumCategories.id, d.id), isNull(forumCategories.groupId))).returning({ id: forumCategories.id });
      if (!res.length) throw new ApiError("NOT_FOUND", "Kategorie nicht gefunden");
    } else {
      const [row] = await db.insert(forumCategories).values(values).returning({ id: forumCategories.id });
      id = row!.id;
    }
    await audit(staff.id, d.id ? "forum.category_update" : "forum.category_create", { type: "forum_category", id: id! }, values);
    revalidatePath("/admin/forum");
    return { id: id! };
  });
}

export async function deleteForumCategory(id: string) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.forum", 60);
    const cid = z.uuid().parse(id);
    const [kids] = await db.select({ n: count() }).from(forumCategories).where(eq(forumCategories.parentId, cid));
    if (kids?.n) throw new ApiError("CONFLICT", "Bitte zuerst die Unterforen löschen oder verschieben");
    const [threads] = await db.select({ n: count() }).from(forumThreads).where(eq(forumThreads.categoryId, cid));
    const [row] = await db.delete(forumCategories).where(and(eq(forumCategories.id, cid), isNull(forumCategories.groupId))).returning();
    if (!row) throw new ApiError("NOT_FOUND", "Kategorie nicht gefunden");
    await audit(staff.id, "forum.category_delete", { type: "forum_category", id: cid }, { name: row.name, slug: row.slug, threads: threads?.n ?? 0 });
    revalidatePath("/admin/forum");
    return { ok: true };
  });
}

export async function addCategoryModerator(input: { categoryId: string; username: string }) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.forum", 60);
    const categoryId = z.uuid().parse(input.categoryId);
    const username = input.username.trim().replace(/^@/, "").toLowerCase();
    const [u] = await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.username, username));
    if (!u || u.status === "deleted") throw new ApiError("NOT_FOUND", `Benutzer «${username}» nicht gefunden`);
    const [cat] = await db.select({ id: forumCategories.id }).from(forumCategories).where(eq(forumCategories.id, categoryId));
    if (!cat) throw new ApiError("NOT_FOUND", "Kategorie nicht gefunden");
    await db.insert(forumCategoryModerators).values({ categoryId, userId: u.id }).onConflictDoNothing();
    await audit(staff.id, "forum.moderator_add", { type: "forum_category", id: categoryId }, { userId: u.id, username });
    revalidatePath("/admin/forum");
    return { ok: true };
  });
}

export async function removeCategoryModerator(input: { categoryId: string; userId: string }) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.forum", 60);
    const categoryId = z.uuid().parse(input.categoryId);
    const userId = z.uuid().parse(input.userId);
    await db.delete(forumCategoryModerators).where(and(eq(forumCategoryModerators.categoryId, categoryId), eq(forumCategoryModerators.userId, userId)));
    await audit(staff.id, "forum.moderator_remove", { type: "forum_category", id: categoryId }, { userId });
    revalidatePath("/admin/forum");
    return { ok: true };
  });
}
