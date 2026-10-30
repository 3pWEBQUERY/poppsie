import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { clubProfiles, users } from "@/db/schema";
import { ReviewWritePage } from "@/components/reviews/review-write-page";

export const metadata: Metadata = { title: "Bericht schreiben" };

export default async function ClubBerichtPage(props: PageProps<"/club/[slug]/bericht">) {
  const { slug } = await props.params;
  const [row] = await db
    .select({ user: users })
    .from(clubProfiles)
    .innerJoin(users, eq(users.id, clubProfiles.userId))
    .where(eq(clubProfiles.slug, decodeURIComponent(slug).toLowerCase()));
  return <ReviewWritePage target={row?.user ?? null} type="club" profileHref={`/club/${slug}`} />;
}
