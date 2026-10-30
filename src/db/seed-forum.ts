import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forumCategories } from "@/db/schema";

type Sub = { slug: string; name: string; description?: string; writeTypes?: string[]; adultOnlyMedia?: boolean };
type Top = { slug: string; name: string; description: string; adultOnlyMedia?: boolean; subs: Sub[] };

/** Forum-Grundstruktur: Regionen (Kantone), Themen, Club-Typen, Off-Topic. */
const STRUCTURE: Top[] = [
  {
    slug: "regionen",
    name: "Regionen",
    description: "Austausch nach Region: Tipps, Erfahrungen und Neuigkeiten aus deiner Gegend.",
    adultOnlyMedia: true,
    subs: [
      { slug: "zuerich", name: "Zürich" },
      { slug: "bern", name: "Bern" },
      { slug: "basel", name: "Basel" },
      { slug: "genf", name: "Genf" },
      { slug: "waadt", name: "Waadt" },
      { slug: "tessin", name: "Tessin" },
      { slug: "luzern-zentralschweiz", name: "Luzern & Zentralschweiz" },
      { slug: "st-gallen-ostschweiz", name: "St. Gallen & Ostschweiz" },
      { slug: "aargau", name: "Aargau" },
      { slug: "uebrige-schweiz", name: "Übrige Schweiz" },
    ],
  },
  {
    slug: "themen",
    name: "Themen",
    description: "Diskussionen rund um Erfahrungen, Sicherheit und Fragen an die Community.",
    subs: [
      { slug: "erfahrungen-tipps", name: "Erfahrungen & Tipps", description: "Teile deine Erfahrungen und hilf anderen weiter.", adultOnlyMedia: true },
      { slug: "sicherheit-gesundheit", name: "Sicherheit & Gesundheit", description: "Safer Sex, Prävention, Sicherheit beim Treffen." },
      { slug: "fragen-an-escorts", name: "Fragen an Escorts", description: "Respektvolle Fragen an Escorts und Clubs." },
      {
        slug: "recht-steuern-bewilligungen",
        name: "Recht, Steuern & Bewilligungen",
        description: "Für Escorts und Clubs: Meldepflicht, Bewilligungen, Steuern und Versicherungen.",
        writeTypes: ["escort", "club"],
      },
    ],
  },
  {
    slug: "club-typen",
    name: "Club-Typen",
    description: "Alles zu Saunaclubs, Laufhäusern, Studios und Kontaktbars.",
    adultOnlyMedia: true,
    subs: [
      { slug: "saunaclubs", name: "Saunaclubs" },
      { slug: "laufhaeuser", name: "Laufhäuser" },
      { slug: "studios", name: "Studios" },
      { slug: "nachtclubs-kontaktbars", name: "Nachtclubs & Kontaktbars" },
    ],
  },
  { slug: "off-topic", name: "Off-Topic", description: "Alles, was sonst nirgends passt.", subs: [] },
];

/** Idempotent: wird bei jedem Serverstart ausgeführt (onConflictDoNothing auf slug). */
export async function seedForum() {
  for (const [i, top] of STRUCTURE.entries()) {
    await db
      .insert(forumCategories)
      .values({ slug: top.slug, name: top.name, description: top.description, sortOrder: i, adultOnlyMedia: top.adultOnlyMedia ?? false })
      .onConflictDoNothing({ target: forumCategories.slug });
    const [parent] = await db.select({ id: forumCategories.id }).from(forumCategories).where(eq(forumCategories.slug, top.slug));
    if (!parent) continue;
    for (const [j, sub] of top.subs.entries()) {
      await db
        .insert(forumCategories)
        .values({
          slug: sub.slug,
          name: sub.name,
          description: sub.description ?? null,
          parentId: parent.id,
          sortOrder: j,
          writeTypes: sub.writeTypes ?? [],
          adultOnlyMedia: sub.adultOnlyMedia ?? top.adultOnlyMedia ?? false,
        })
        .onConflictDoNothing({ target: forumCategories.slug });
    }
  }
}
