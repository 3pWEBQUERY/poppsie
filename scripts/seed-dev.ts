/**
 * Demo-Daten für die Entwicklung: Admin, Mitglieder, verifizierte Escorts und Clubs (Passwort für alle: "poppsie-demo-2026").
 * Aufruf: npx tsx scripts/seed-dev.ts
 */
import "../server/env";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import sharp from "sharp";
import { and, count } from "drizzle-orm";
import { clubProfiles, escortProfiles, media, profileLanguages, users } from "@/db/schema";
import { processImage } from "@/lib/media/process";
import { hashPassword } from "@/lib/auth/password";
import { CITIES } from "@/lib/geo/cities";

const ESCORTS = [
  ["sophia.fire", "Sophia", "frau", "Zürich", 27, "C", ["gfe", "massage", "kuesse", "dinner_date"]],
  ["lena_ch", "Lena", "frau", "Basel", 31, "B", ["abendbegleitung", "reisebegleitung", "kuscheln"]],
  ["mia.lugano", "Mia", "frau", "Lugano", 24, "D", ["gfe", "striptease", "duschen"]],
  ["nina.bern", "Nina", "frau", "Bern", 35, "C", ["dominant", "lack_leder", "fesseln"]],
  ["chloe.geneve", "Chloé", "frau", "Genf", 29, "B", ["dinner_date", "overnight", "gfe"]],
  ["valentina", "Valentina", "trans", "Zürich", 26, "C", ["massage", "rollenspiele", "kuesse"]],
  ["anna.luzern", "Anna", "frau", "Luzern", 41, "D", ["tantra", "massage", "kuscheln"]],
  ["julia.stgallen", "Julia", "frau", "St. Gallen", 33, "E", ["paare", "frauen", "gfe"]],
] as const;

const CLUBS = [
  ["palais_zh", "Palais Oase", "saunaclub", "Zürich"],
  ["studio.rosa", "Studio Rosa", "studio", "Basel"],
  ["nightlife.lu", "Moulin Noir", "nachtclub", "Luzern"],
] as const;

async function upsertUser(v: typeof users.$inferInsert) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, v.username));
  if (existing) return existing.id;
  const [row] = await db.insert(users).values(v).returning({ id: users.id });
  return row!.id;
}

const COLORS = ["#d1202f", "#2b2f35", "#7a1d2a", "#3d4450", "#b3541e", "#5b2a86"];

/** Platzhalterbild (flache Fläche + Initiale), durch die normale Bildpipeline verarbeitet. */
async function placeholder(ownerId: string, label: string, i: number) {
  const bg = COLORS[(label.charCodeAt(0) + i) % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="${bg}"/><circle cx="450" cy="520" r="${180 + i * 30}" fill="#ffffff" fill-opacity="0.12"/><text x="450" y="600" font-family="Arial" font-size="260" font-weight="700" fill="#ffffff" text-anchor="middle">${label.slice(0, 1)}</text></svg>`;
  return processImage(await sharp(Buffer.from(svg)).jpeg().toBuffer(), ownerId);
}

async function ensureMedia(userId: string, label: string, blur: boolean) {
  const [{ n }] = await db.select({ n: count() }).from(media).where(and(eq(media.ownerId, userId), eq(media.purpose, "gallery")));
  if (n > 0) return;
  for (let i = 0; i < 4; i++) {
    const img = await placeholder(userId, label, i);
    const [m] = await db
      .insert(media)
      .values({ ownerId: userId, kind: "image", purpose: i === 0 ? "avatar" : "gallery", mime: "image/webp", blurForGuests: blur && i > 1, sortOrder: i, ...img })
      .returning({ id: media.id });
    if (i === 0) await db.update(users).set({ avatarMediaId: m!.id }).where(eq(users.id, userId));
  }
}

async function main() {
  const passwordHash = await hashPassword("poppsie-demo-2026");
  const base = { passwordHash, status: "active" as const, country: "CH", profileComplete: true, profileScore: 90 };

  await upsertUser({ ...base, username: "admin", email: "admin@poppsie.test", accountType: "member", role: "admin", region: "ZH" });
  for (const [u, region] of [["max.muster", "ZH"], ["peter_be", "BE"], ["luca.ti", "TI"], ["thomas.bs", "BS"], ["inkognito.ich", "ZH"]] as const) {
    await upsertUser({ ...base, username: u, email: `${u}@poppsie.test`, accountType: "member", region, incognito: u === "inkognito.ich", bio: "Diskreter Geniesser aus der Region." });
  }
  for (const [u, name, gender, cityName, age, cup, services] of ESCORTS) {
    const city = CITIES.find((c) => c.name === cityName)!;
    const id = await upsertUser({ ...base, username: u, email: `${u}@poppsie.test`, accountType: "escort", kycStatus: "verified", region: city.region, bio: `Hallo, ich bin ${name}.` });
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - age, 2, 14);
    await db
      .insert(escortProfiles)
      .values({
        userId: id,
        displayName: name,
        slogan: "Herzlich, diskret und mit viel Zeit für dich",
        about: `Ich bin ${name}, ${age} Jahre jung und empfange dich in ${cityName} in stilvollem Ambiente. Ich liebe gute Gespräche, Lachen und Zärtlichkeit. Diskretion ist für mich selbstverständlich.`,
        gender,
        birthDate: birth.toISOString().slice(0, 10),
        heightCm: 160 + (age % 15),
        weightKg: 50 + (age % 12),
        nationality: ["CH", "IT", "FR", "BR", "RO", "ES", "DE", "HU"][age % 8],
        cupSize: cup,
        breastType: age % 2 ? "natuerlich" : "operiert",
        intimate: "rasiert",
        tattoos: age % 3 ? "wenige" : "keine",
        piercings: ["ohren"],
        clothingStyles: ["elegant", "sexy"],
        hairColor: ["blond", "brünett", "schwarz", "rot"][age % 4],
        eyeColor: ["blau", "grün", "braun"][age % 3],
        city: city.name,
        country: city.country,
        lat: city.lat,
        lng: city.lng,
        services: [...services],
        prices: [
          { minutes: 30, price: 200 },
          { minutes: 60, price: 350 },
          { minutes: 120, price: 600 },
        ],
        workplace: "both",
        blurForGuests: true,
      })
      .onConflictDoNothing();
    await db.insert(profileLanguages).values([{ userId: id, languageCode: "de", level: 5 }, { userId: id, languageCode: "en", level: 3 }]).onConflictDoNothing();
    await ensureMedia(id, name, true);
  }
  for (const [u, name, type, cityName] of CLUBS) {
    const city = CITIES.find((c) => c.name === cityName)!;
    const id = await upsertUser({ ...base, username: u, email: `${u}@poppsie.test`, accountType: "club", kycStatus: "verified", region: city.region });
    await db
      .insert(clubProfiles)
      .values({
        userId: id,
        slug: u.replace(/[._]/g, "-"),
        name,
        clubType: type,
        description: `${name} – dein Treffpunkt in ${cityName}. Gepflegtes Ambiente, freundliche Damen und absolute Diskretion.`,
        street: "Musterstrasse 12",
        postalCode: "8000",
        city: city.name,
        lat: city.lat,
        lng: city.lng,
        openingHours: { mo: [{ from: "12:00", to: "02:00" }], di: [{ from: "12:00", to: "02:00" }], fr: [{ from: "12:00", to: "04:00" }], sa: [{ from: "14:00", to: "04:00" }] },
        data: { entryPrice: 80, parking: true, discreetEntrance: true, payment: ["Bar", "TWINT"], roomRates: ["30 min: 150", "60 min: 250"], roomCount: 12, wellness: ["Sauna", "Whirlpool"], bar: "Softdrinks, Champagner" },
      })
      .onConflictDoNothing();
    await ensureMedia(id, name, false);
  }
  console.log("Demo-Daten angelegt. Passwort: poppsie-demo-2026");
  process.exit(0);
}

main();
