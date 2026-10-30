/**
 * Demo-Daten für das Community-Modul: Follows, Feed-Beiträge mit Medien, verschachtelte Kommentare,
 * Reaktionen, Forum-Themen (inkl. Umfrage, Zitate), Gruppen mit Gruppen-Feed/-Forum und Stories.
 * Idempotent (überspringt, wenn bereits angelegt). Aufruf lokal: npx tsx scripts/seed-community.ts, auf Railway: SEED_DEMO=1
 */
import sharp from "sharp";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  comments,
  follows,
  forumCategories,
  forumSubscriptions,
  forumThreads,
  groupMembers,
  groups,
  media,
  pollOptions,
  polls,
  pollVotes,
  postMedia,
  posts,
  reactions,
  stories,
  storyComments,
  storyViews,
  users,
} from "@/db/schema";
import { seedForum } from "@/db/seed-forum";
import { processImage } from "@/lib/media/process";

const H = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * H);
const COLORS = ["#d1202f", "#2b2f35", "#7a1d2a", "#3d4450", "#b3541e", "#5b2a86", "#1f5f5b", "#8a6d1d"];
const tagsOf = (t: string) => [...new Set([...t.matchAll(/#([\p{L}0-9_]{2,40})/gu)].map((m) => m[1]!.toLowerCase()))];

async function image(ownerId: string, label: string, i: number, purpose: "post" | "story" | "group", w = 1200, h = 900) {
  const bg = COLORS[(label.charCodeAt(0) + i) % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.28}" fill="#ffffff" fill-opacity="0.10"/><rect x="${w * 0.08}" y="${h * 0.62}" width="${w * 0.5}" height="${h * 0.08}" rx="12" fill="#ffffff" fill-opacity="0.18"/><text x="${w * 0.08}" y="${h * 0.55}" font-family="Arial" font-size="${Math.round(Math.min(w, h) * 0.11)}" font-weight="700" fill="#ffffff">${label}</text></svg>`;
  const img = await processImage(await sharp(Buffer.from(svg)).jpeg().toBuffer(), ownerId);
  const [m] = await db.insert(media).values({ ownerId, kind: "image", purpose, mime: "image/webp", ...img }).returning({ id: media.id });
  return m!.id;
}

/** Community-Demo-Daten (idempotent). Setzt die Demo-Profile aus seedDemo() voraus. */
export async function seedCommunity() {
  await seedForum();
  const [marker] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, "zuerich-nightlife"));
  if (marker) {
    return false;
  }
  const all = await db.select({ id: users.id, username: users.username }).from(users);
  const u = Object.fromEntries(all.map((x) => [x.username, x.id])) as Record<string, string>;
  const need = ["max.muster", "peter_be", "luca.ti", "thomas.bs", "inkognito.ich", "sophia.fire", "lena_ch", "mia.lugano", "nina.bern", "valentina", "palais_zh", "studio.rosa", "admin"];
  for (const n of need) if (!u[n]) throw new Error(`Benutzer ${n} fehlt – zuerst scripts/seed-dev.ts ausführen`);

  // Follows
  const followPairs: [string, string][] = [
    ["max.muster", "lena_ch"],
    ["max.muster", "palais_zh"],
    ["max.muster", "valentina"],
    ["peter_be", "nina.bern"],
    ["peter_be", "lena_ch"],
    ["luca.ti", "mia.lugano"],
    ["thomas.bs", "lena_ch"],
    ["thomas.bs", "studio.rosa"],
    ["inkognito.ich", "lena_ch"],
    ["lena_ch", "palais_zh"],
  ];
  await db
    .insert(follows)
    .values(followPairs.map(([a, b]) => ({ followerId: u[a]!, followeeId: u[b]! })))
    .onConflictDoNothing();

  // Feed-Beiträge
  type P = { by: string; h: number; body: string; vis?: "public" | "followers" | "members"; imgs?: number };
  const feed: P[] = [
    { by: "lena_ch", h: 1, body: "Guten Morgen Basel ☀️ Heute bin ich ab 14 Uhr wieder für dich da. Wer hat Lust auf einen gemütlichen Nachmittag? #basel #heuteverfügbar", imgs: 2 },
    { by: "palais_zh", h: 3, body: "**Ladies Night** im Palais Oase: Diesen Freitag freier Eintritt in den Wellnessbereich für alle Gäste vor 18 Uhr! 🧖‍♀️🔥 #saunaclub #zürich", imgs: 3 },
    { by: "max.muster", h: 5, body: "Danke an @lena_ch für den wunderbaren Abend gestern. Absolut empfehlenswert, herzlich und diskret. *Gerne wieder!* #erfahrung", vis: "members" },
    { by: "mia.lugano", h: 8, body: "Ciao a tutti! Neue Fotos sind online 📸 Ich bin diese Woche in Lugano und ab Montag in Zürich. #lugano #tessin", imgs: 4 },
    { by: "valentina", h: 12, body: "Nur für meine Follower: Nächste Woche gibt es ein kleines Special für Stammgäste 💋", vis: "followers" },
    { by: "peter_be", h: 20, body: "Kennt jemand gute Tipps für ein diskretes Hotel in Bern? Bitte per Kommentar, danke! #bern #tipps" },
    { by: "studio.rosa", h: 30, body: "Wir suchen Verstärkung für unser Team in Basel. Faire Konditionen, sicheres Umfeld, Wohnmöglichkeit vorhanden. Melde dich per Nachricht. #basel #studio", imgs: 1 },
    { by: "nina.bern", h: 44, body: "Sicherheit geht vor: Ich treffe neue Gäste nur nach kurzer Verifikation. Danke für euer Verständnis 🙏 #sicherheit" },
    { by: "thomas.bs", h: 60, body: "Erster Beitrag hier – freue mich auf den Austausch mit euch! 👋" },
    { by: "lena_ch", h: 80, body: "Wochenende in Zürich 🌃 Ich bin von Freitag bis Sonntag im Kreis 1. #zürich", imgs: 1 },
    { by: "palais_zh", h: 100, body: "Neu bei uns: Whirlpool-Lounge mit Bar. Kommt vorbei und überzeugt euch selbst 🥂 #saunaclub", imgs: 2 },
    { by: "luca.ti", h: 130, body: "Grüsse aus dem Tessin! Gibt es hier noch andere aus der Region Lugano? #tessin" },
  ];
  const postIds: string[] = [];
  for (const p of feed) {
    const [row] = await db
      .insert(posts)
      .values({ authorId: u[p.by]!, context: "feed", body: p.body, hashtags: tagsOf(p.body), visibility: p.vis ?? "public", createdAt: ago(p.h) })
      .returning({ id: posts.id });
    postIds.push(row!.id);
    for (let i = 0; i < (p.imgs ?? 0); i++) {
      const mid = await image(u[p.by]!, p.by.split(/[._]/)[0]!.toUpperCase(), i, "post", i % 2 ? 900 : 1200, i % 2 ? 1200 : 900);
      await db.insert(postMedia).values({ postId: row!.id, mediaId: mid, sortOrder: i });
    }
  }
  // Beitrag mit eingebettetem Profil
  const [embedPost] = await db
    .insert(posts)
    .values({ authorId: u["max.muster"]!, context: "feed", body: "Schaut euch mal dieses Profil an – sehr sympathisch!", embeds: [{ type: "profile", id: u["mia.lugano"]! }], createdAt: ago(2) })
    .returning({ id: posts.id });
  postIds.push(embedPost!.id);

  // Kommentare (verschachtelt, 5 Ebenen) auf dem Hotel-Beitrag
  const hotel = postIds[5]!;
  const chain = [
    ["lena_ch", "Das Hotel Schweizerhof ist sehr diskret und zentral 👍"],
    ["peter_be", "Danke! Hast du dort schon Erfahrung mit späten Check-ins?"],
    ["lena_ch", "Ja, die Rezeption ist rund um die Uhr besetzt."],
    ["nina.bern", "Kann ich bestätigen. Auch das Personal ist sehr professionell."],
    ["peter_be", "Super, dann buche ich dort. Merci euch allen! 🙏"],
  ] as const;
  let parent: string | null = null;
  for (const [i, [by, body]] of chain.entries()) {
    const [c]: { id: string }[] = await db
      .insert(comments)
      .values({ postId: hotel, parentId: parent, depth: i, authorId: u[by]!, body, createdAt: ago(19 - i) })
      .returning({ id: comments.id });
    parent = c!.id;
  }
  await db.insert(comments).values({ postId: hotel, authorId: u["max.muster"]!, body: "Das Bellevue ist auch gut, aber teurer.", createdAt: ago(10) });
  await db.update(posts).set({ commentCount: 6 }).where(eq(posts.id, hotel));
  await db.insert(comments).values([
    { postId: postIds[0]!, authorId: u["max.muster"]!, body: "Schöne Bilder 😍", createdAt: ago(0.5) },
    { postId: postIds[1]!, authorId: u["peter_be"]!, body: "Klingt super, bin dabei! 🔥", createdAt: ago(2) },
  ]);
  await db.update(posts).set({ commentCount: 1 }).where(inArray(posts.id, [postIds[0]!, postIds[1]!]));

  // Reaktionen
  const kinds = ["like", "love", "fire", "laugh", "wow", "sad"] as const;
  const reactors = ["max.muster", "peter_be", "luca.ti", "thomas.bs", "inkognito.ich", "lena_ch", "valentina"];
  for (const [pi, pid] of postIds.entries()) {
    const n = (pi * 3) % reactors.length;
    const vals = reactors.slice(0, n + 1).map((r, j) => ({ targetType: "post" as const, targetId: pid, userId: u[r]!, kind: kinds[(pi + j) % (j % 3 === 0 ? 1 : 3)]! }));
    await db.insert(reactions).values(vals).onConflictDoNothing();
    await db.update(posts).set({ reactionCount: vals.length }).where(eq(posts.id, pid));
  }

  // Forum
  const cats = await db.select().from(forumCategories);
  const cat = (slug: string) => cats.find((c) => c.slug === slug)!.id;
  type T = { cat: string; by: string; title: string; prefix?: string; tags?: string[]; body: string; h: number; pinned?: boolean; solved?: boolean; locked?: boolean; replies: [string, string, boolean?][]; img?: boolean };
  const threads: T[] = [
    {
      cat: "sicherheit-gesundheit",
      by: "admin",
      title: "Forenregeln & Sicherheitshinweise – bitte lesen",
      prefix: "Info",
      tags: ["regeln"],
      pinned: true,
      locked: true,
      h: 400,
      body: "Willkommen im Poppsie-Forum! **Respekt** ist bei uns Pflicht. Keine Klarnamen, keine Telefonnummern, keine Preise im Forum. Verdacht auf Zwang oder Minderjährigkeit bitte sofort melden.",
      replies: [],
    },
    {
      cat: "zuerich",
      by: "max.muster",
      title: "Beste Saunaclubs in Zürich und Umgebung?",
      prefix: "Frage",
      tags: ["saunaclub", "zürich"],
      h: 50,
      body: "Hallo zusammen, ich bin neu in Zürich und suche Empfehlungen für gepflegte Saunaclubs. Worauf sollte man achten?",
      img: true,
      replies: [
        ["peter_be", "Das Palais Oase ist sehr gepflegt, faire Eintrittspreise und freundliches Personal."],
        ["palais_zh", "Danke für die Empfehlung! Wir freuen uns auf deinen Besuch 😊"],
        ["thomas.bs", "Achte auf Sauberkeit und darauf, dass die Damen selbstständig arbeiten. Das merkt man schnell.", true],
        ["max.muster", "Danke euch, sehr hilfreich!"],
      ],
    },
    {
      cat: "erfahrungen-tipps",
      by: "thomas.bs",
      title: "Tipps für das erste Treffen mit einer Escort",
      prefix: "Tipp",
      tags: ["anfänger", "tipps"],
      solved: true,
      h: 120,
      body: "Ich habe ein paar Tipps gesammelt: pünktlich sein, frisch geduscht, Kuvert bereitlegen, Grenzen respektieren. Was würdet ihr ergänzen?",
      replies: [
        ["lena_ch", "Ganz wichtig: vorher klar kommunizieren, was man sich wünscht. Wir freuen uns über ehrliche Gäste."],
        ["nina.bern", "Und bitte nicht zu viel Parfum 😅"],
        ["peter_be", "Diskretion gilt in beide Richtungen. Top Liste!"],
      ],
    },
    {
      cat: "recht-steuern-bewilligungen",
      by: "lena_ch",
      title: "Meldepflicht im Kanton Basel-Stadt – Erfahrungen?",
      prefix: "Frage",
      tags: ["bewilligung", "basel"],
      h: 70,
      body: "Hat jemand aktuelle Erfahrungen mit der Anmeldung im Kanton Basel-Stadt? Welche Dokumente braucht man?",
      replies: [
        ["studio.rosa", "Pass, Aufenthaltsbewilligung und eine Krankenversicherung. Termin vorher online buchen."],
        ["nina.bern", "In Bern ist es ähnlich, aber mit Wartezeit von ca. 2 Wochen."],
      ],
    },
    { cat: "tessin", by: "luca.ti", title: "Tessin-Stammtisch: Wer ist dabei?", prefix: "Diskussion", tags: ["tessin"], h: 15, body: "Lust auf einen lockeren Austausch hier im Thread? Neuigkeiten aus dem Tessin bitte hier rein.", replies: [["mia.lugano", "Ciao Luca! Ich bin diese Woche in Lugano 😊"]] },
    { cat: "off-topic", by: "peter_be", title: "Welche Serie schaut ihr gerade?", tags: ["serien"], h: 9, body: "Mal was ganz anderes: Was schaut ihr gerade? Ich bin bei *The Bear* hängen geblieben.", replies: [["max.muster", "Shogun! Absolut sehenswert."], ["valentina", "Bridgerton 😂"]] },
    { cat: "saunaclubs", by: "palais_zh", title: "Was wünscht ihr euch von einem modernen Saunaclub?", prefix: "Diskussion", tags: ["saunaclub", "umfrage"], h: 26, body: "Wir planen einen Umbau und möchten eure Meinung hören. Stimmt in der Umfrage ab!", replies: [["max.muster", "Mehr Ruhezonen bitte!"]] },
  ];
  let pollThread: string | null = null;
  for (const t of threads) {
    const [th] = await db
      .insert(forumThreads)
      .values({
        categoryId: cat(t.cat),
        authorId: u[t.by]!,
        title: t.title,
        prefix: t.prefix ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        solved: t.solved ?? false,
        locked: t.locked ?? false,
        replyCount: t.replies.length,
        viewCount: 20 + t.replies.length * 17,
        createdAt: ago(t.h),
        lastPostAt: ago(t.h - t.replies.length * 2),
      })
      .returning({ id: forumThreads.id });
    if (t.title.startsWith("Was wünscht")) pollThread = th!.id;
    const [first] = await db.insert(posts).values({ authorId: u[t.by]!, context: "forum", threadId: th!.id, body: t.body, hashtags: tagsOf(t.body), createdAt: ago(t.h) }).returning({ id: posts.id });
    if (t.img) await db.insert(postMedia).values({ postId: first!.id, mediaId: await image(u[t.by]!, "ZÜRICH", 2, "post") });
    await db.insert(forumSubscriptions).values({ userId: u[t.by]!, threadId: th!.id }).onConflictDoNothing();
    let prevId = first!.id;
    for (const [i, [by, body, quote]] of t.replies.entries()) {
      const [r] = await db
        .insert(posts)
        .values({ authorId: u[by]!, context: "forum", threadId: th!.id, body, quoteId: quote ? prevId : null, createdAt: ago(t.h - (i + 1) * 2) })
        .returning({ id: posts.id });
      await db.insert(reactions).values({ targetType: "post", targetId: r!.id, userId: u[t.by]!, kind: "like" }).onConflictDoNothing();
      await db.update(posts).set({ reactionCount: 1 }).where(eq(posts.id, r!.id));
      prevId = r!.id;
    }
  }
  if (pollThread) {
    const [p] = await db.insert(polls).values({ threadId: pollThread, question: "Was ist euch am wichtigsten?", multiple: true, closesAt: new Date(Date.now() + 7 * 24 * H) }).returning();
    const opts = await db
      .insert(pollOptions)
      .values(["Grösserer Wellnessbereich", "Ruhezonen", "Bessere Bar", "Längere Öffnungszeiten"].map((label, i) => ({ pollId: p!.id, label, sortOrder: i })))
      .returning();
    await db.insert(pollVotes).values([
      { optionId: opts[0]!.id, userId: u["max.muster"]! },
      { optionId: opts[1]!.id, userId: u["max.muster"]! },
      { optionId: opts[1]!.id, userId: u["peter_be"]! },
      { optionId: opts[3]!.id, userId: u["thomas.bs"]! },
    ]);
  }

  // Gruppen
  type G = { slug: string; name: string; privacy: "public" | "private" | "secret"; owner: string; region?: string; desc: string; rules?: string; approval?: boolean; members: [string, "admin" | "moderator" | "member", ("active" | "pending" | "invited")?][] };
  const gs: G[] = [
    {
      slug: "zuerich-nightlife",
      name: "Zürich Nightlife",
      privacy: "public",
      owner: "max.muster",
      region: "ZH",
      desc: "Alles rund ums Nachtleben in Zürich: Clubs, Events, Tipps und Treffen.",
      rules: "1. Respektvoller Umgang\n2. Keine Werbung ohne Absprache\n3. Keine Klarnamen",
      members: [["peter_be", "moderator"], ["palais_zh", "member"], ["valentina", "member"], ["inkognito.ich", "member"], ["thomas.bs", "member", "pending"]],
    },
    {
      slug: "escort-netzwerk-schweiz",
      name: "Escort-Netzwerk Schweiz",
      privacy: "private",
      owner: "lena_ch",
      desc: "Geschützter Austausch unter Escorts: Sicherheit, Recht, Steuern und gegenseitige Unterstützung.",
      approval: true,
      members: [["nina.bern", "admin"], ["mia.lugano", "member"], ["valentina", "member"], ["sophia.fire", "member", "pending"]],
    },
    { slug: "basel-geniesser", name: "Basel Geniesser", privacy: "public", owner: "thomas.bs", region: "BS", desc: "Für alle Geniesser aus Basel und der Region.", members: [["lena_ch", "member"], ["studio.rosa", "member"]] },
    { slug: "vip-zirkel", name: "VIP-Zirkel", privacy: "secret", owner: "palais_zh", region: "ZH", desc: "Geschlossene Runde für Stammgäste. Nur auf Einladung.", members: [["max.muster", "member"], ["peter_be", "member", "invited"]] },
  ];
  for (const g of gs) {
    const cover = await image(u[g.owner]!, g.name.split(" ")[0]!.toUpperCase(), 1, "group", 1500, 500);
    const [row] = await db
      .insert(groups)
      .values({ slug: g.slug, name: g.name, privacy: g.privacy, ownerId: u[g.owner]!, region: g.region ?? null, description: g.desc, rules: g.rules ?? null, coverMediaId: cover, requirePostApproval: g.approval ?? false, createdAt: ago(500) })
      .returning({ id: groups.id });
    const gid = row!.id;
    await db.insert(groupMembers).values([{ groupId: gid, userId: u[g.owner]!, role: "owner" as const, status: "active" as const }, ...g.members.map(([m, role, status]) => ({ groupId: gid, userId: u[m]!, role, status: status ?? ("active" as const) }))]);
    await db.update(groups).set({ memberCount: 1 + g.members.filter((m) => !m[2] || m[2] === "active").length }).where(eq(groups.id, gid));
    const [fc] = await db.insert(forumCategories).values({ slug: `gruppe-${g.slug}`, name: `Forum: ${g.name}`, groupId: gid, description: `Gruppen-Forum von ${g.name}` }).returning({ id: forumCategories.id });
    const active = [g.owner, ...g.members.filter((m) => !m[2] || m[2] === "active").map((m) => m[0])];
    for (const [i, by] of active.slice(0, 3).entries()) {
      await db.insert(posts).values({ authorId: u[by]!, context: "group", groupId: gid, visibility: "members", body: [`Willkommen in ${g.name}! 🎉 Stellt euch gerne kurz vor.`, "Hallo zusammen, schön hier zu sein!", "Wer ist am Wochenende unterwegs?"][i]!, createdAt: ago(40 - i * 10) });
    }
    if (g.approval) await db.insert(posts).values({ authorId: u["mia.lugano"]!, context: "group", groupId: gid, visibility: "members", approved: false, body: "Hat jemand Erfahrung mit Versicherungen für Selbstständige?", createdAt: ago(1) });
    const [th] = await db.insert(forumThreads).values({ categoryId: fc!.id, authorId: u[g.owner]!, title: `Vorstellungsrunde ${g.name}`, replyCount: 1, createdAt: ago(45), lastPostAt: ago(30) }).returning({ id: forumThreads.id });
    await db.insert(posts).values([
      { authorId: u[g.owner]!, context: "forum", threadId: th!.id, groupId: gid, body: "Hier kann sich jedes neue Mitglied kurz vorstellen.", createdAt: ago(45) },
      { authorId: u[active[1]!]!, context: "forum", threadId: th!.id, groupId: gid, body: "Ich mache den Anfang 😊", createdAt: ago(30) },
    ]);
  }
  // Ein geteilter Thread in einer Gruppe
  const [zg] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, "zuerich-nightlife"));
  const [saunaThread] = await db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.title, "Beste Saunaclubs in Zürich und Umgebung?"));
  await db.insert(posts).values({ authorId: u["peter_be"]!, context: "group", groupId: zg!.id, visibility: "members", body: "Passend zur Gruppe – spannende Diskussion im Forum:", embeds: [{ type: "thread", id: saunaThread!.id }], createdAt: ago(4) });

  // Stories
  const st: [string, string, string | null, { type: "city" | "available_today" | "book_link"; value?: string; x: number; y: number }[], number, string?][] = [
    ["lena_ch", "LENA", "Heute in Basel 💋", [{ type: "city", value: "Basel", x: 30, y: 18 }, { type: "available_today", x: 68, y: 72 }], 2],
    ["lena_ch", "LENA", null, [{ type: "book_link", x: 50, y: 82 }], 1],
    ["lena_ch", "LENA", "Mein Lieblingsplatz", [], 50, "Basel"],
    ["lena_ch", "LENA", "Ferien 🌴", [], 70, "Reisen"],
    ["mia.lugano", "MIA", "Ciao Lugano!", [{ type: "city", value: "Lugano", x: 50, y: 20 }], 4],
    ["palais_zh", "PALAIS", "Ladies Night am Freitag", [{ type: "city", value: "Zürich", x: 50, y: 15 }], 6],
    ["valentina", "VALENTINA", null, [{ type: "available_today", x: 50, y: 50 }], 9],
    ["nina.bern", "NINA", "Neue Fotos online", [], 12],
  ];
  for (const [i, [by, label, text, stickers, h, highlight]] of st.entries()) {
    const mid = await image(u[by]!, label, i, "story", 1080, 1920);
    const created = ago(h);
    const [s] = await db
      .insert(stories)
      .values({ authorId: u[by]!, mediaId: mid, overlayText: text, stickers, highlight: Boolean(highlight), highlightTitle: highlight ?? null, createdAt: created, expiresAt: new Date(created.getTime() + 24 * H) })
      .returning({ id: stories.id });
    if (by === "lena_ch" && h < 24) {
      await db.insert(storyViews).values([
        { storyId: s!.id, viewerId: u["max.muster"]!, incognito: false },
        { storyId: s!.id, viewerId: u["inkognito.ich"]!, incognito: true },
        { storyId: s!.id, viewerId: u["thomas.bs"]!, incognito: false },
      ]);
      await db.insert(reactions).values({ targetType: "story", targetId: s!.id, userId: u["max.muster"]!, kind: "love" }).onConflictDoNothing();
      await db.insert(storyComments).values({ storyId: s!.id, authorId: u["max.muster"]!, body: "Wunderschön 😍" });
    }
  }
  return true;
}
