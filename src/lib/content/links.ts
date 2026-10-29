import type { EmbedType } from "./types";

/** Erkannter Poppsie-Link (vor der Auflösung zur ID). */
export type LinkRef = { type: EmbedType; key: string; by: "id" | "username" | "slug" | "club" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const PATTERNS: { re: RegExp; type: EmbedType; by: LinkRef["by"] }[] = [
  { re: new RegExp(`^/forum/thread/(${UUID})`, "i"), type: "thread", by: "id" },
  { re: new RegExp(`^/feed/(${UUID})`, "i"), type: "post", by: "id" },
  { re: new RegExp(`^/stories/(${UUID})`, "i"), type: "highlight", by: "id" },
  { re: /^\/escort\/([a-z0-9._]{3,20})(?:\/|$|\?|#)/i, type: "profile", by: "username" },
  { re: /^\/(?:u|p)\/([a-z0-9._]{3,20})(?:\/|$|\?|#)/i, type: "profile", by: "username" },
  { re: /^\/club\/([a-z0-9-]{2,80})(?:\/|$|\?|#)/i, type: "profile", by: "club" },
  { re: /^\/gruppen\/(?!neu(?:\/|$|\?|#))([a-z0-9-]{2,80})(?:\/|$|\?|#)/i, type: "group", by: "slug" },
];

/** Ist das ein Poppsie-Link? Erlaubt relative Pfade und absolute URLs der eigenen Hosts. */
export function parsePoppsieLink(raw: string, hosts: string[]): LinkRef | null {
  let path = raw.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (!hosts.includes(u.host)) return null;
      path = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/")) return null;
  const withEnd = path.endsWith("/") ? path : `${path}/`;
  for (const p of PATTERNS) {
    const m = p.re.exec(p.by === "id" ? path : withEnd);
    if (m) return { type: p.type, key: m[1]!.toLowerCase(), by: p.by };
  }
  return null;
}

/** Alle URLs in einem Text finden (für das automatische Einbetten beim Einfügen). */
export function findUrls(text: string) {
  return [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => m[0]);
}

export function embedHref(type: EmbedType, id: string) {
  switch (type) {
    case "thread":
      return `/forum/thread/${id}`;
    case "post":
      return `/feed/${id}`;
    case "highlight":
      return `/stories/${id}`;
    default:
      return "/";
  }
}
