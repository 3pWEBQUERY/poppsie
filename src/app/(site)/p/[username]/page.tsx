import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles } from "@/db/schema";
import { findUser } from "@/lib/profiles/public";
import { profileHref } from "@/lib/users/summary";

/** Kurzlink für @Erwähnungen: leitet auf die passende Profilseite weiter (Sichtbarkeit prüft die Zielseite). */
export default async function ProfileRedirect(props: PageProps<"/p/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const u = await findUser(decodeURIComponent(username).replace(/^@/, ""));
  if (!u || u.status === "deleted") notFound();
  let clubSlug: string | null = null;
  if (u.accountType === "club") {
    const [c] = await db.select({ slug: clubProfiles.slug }).from(clubProfiles).where(eq(clubProfiles.userId, u.id));
    clubSlug = c?.slug ?? null;
  }
  const src = typeof sp.src === "string" ? `?src=${encodeURIComponent(sp.src)}` : "";
  redirect(profileHref({ username: u.username, accountType: u.accountType, clubSlug }) + src);
}
