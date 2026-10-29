export type AccountType = "member" | "escort" | "club";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  types: AccountType[];
  /** Frei zugänglich, auch wenn das Profil nicht abgeschlossen ist. */
  free?: boolean;
  section: "main" | "provider" | "account";
};

const ALL: AccountType[] = ["member", "escort", "club"];
const PROVIDERS: AccountType[] = ["escort", "club"];

/** Dashboard-Bereiche je Kontotyp (PRD Kapitel 3). */
export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Übersicht", icon: "layout-dashboard", types: ALL, free: true, section: "main" },
  { href: "/feed", label: "Newsfeed", icon: "newspaper", types: ALL, section: "main" },
  { href: "/dashboard/nachrichten", label: "Messenger", icon: "message-circle", types: ALL, section: "main" },
  { href: "/dashboard/mitteilungen", label: "Mitteilungen", icon: "bell", types: ALL, free: true, section: "main" },
  { href: "/dashboard/favoriten", label: "Favoriten", icon: "heart", types: ALL, section: "main" },
  { href: "/dashboard/praeferenzen", label: "Präferenzen", icon: "sliders-horizontal", types: ["member"], section: "main" },
  { href: "/dashboard/matches", label: "Meine Matches", icon: "sparkles", types: ["member"], section: "main" },
  { href: "/dashboard/suchen", label: "Gespeicherte Suchen", icon: "bookmark", types: ["member"], section: "main" },
  { href: "/dashboard/berichte", label: "Berichte", icon: "star", types: ALL, section: "main" },
  { href: "/dashboard/kalender", label: "Kalender & Buchungen", icon: "calendar", types: ALL, section: "main" },
  { href: "/dashboard/besucher", label: "Profilbesucher", icon: "eye", types: ALL, section: "main" },
  { href: "/dashboard/profil", label: "Profil bearbeiten", icon: "user-pen", types: ALL, free: true, section: "provider" },
  { href: "/dashboard/galerie", label: "Galerie", icon: "images", types: PROVIDERS, free: true, section: "provider" },
  { href: "/dashboard/stories", label: "Stories", icon: "circle-play", types: PROVIDERS, section: "provider" },
  { href: "/dashboard/planer", label: "Planer", icon: "calendar-clock", types: PROVIDERS, section: "provider" },
  { href: "/dashboard/statistiken", label: "Statistiken", icon: "chart-column", types: PROVIDERS, section: "provider" },
  { href: "/dashboard/verknuepfungen", label: "Line-up & Clubs", icon: "link", types: PROVIDERS, section: "provider" },
  { href: "/dashboard/verifikation", label: "Verifikation", icon: "badge-check", types: PROVIDERS, free: true, section: "provider" },
  { href: "/dashboard/sichtbarkeit", label: "Sichtbarkeit & Privatsphäre", icon: "shield", types: ALL, section: "account" },
  { href: "/dashboard/einstellungen", label: "Kontoeinstellungen", icon: "settings", types: ALL, free: true, section: "account" },
  { href: "/hilfe", label: "Hilfe", icon: "life-buoy", types: ALL, free: true, section: "account" },
];

export function navFor(type: AccountType) {
  return DASHBOARD_NAV.filter((i) => i.types.includes(type));
}

export function isFreePath(pathname: string) {
  const item = [...DASHBOARD_NAV].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.free ?? false;
}
