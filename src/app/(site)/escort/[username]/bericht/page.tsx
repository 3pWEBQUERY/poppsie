import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ReviewWritePage } from "@/components/reviews/review-write-page";

export const metadata: Metadata = { title: "Bericht schreiben" };

export default async function EscortBerichtPage(props: PageProps<"/escort/[username]/bericht">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, decodeURIComponent(username).toLowerCase()), eq(users.accountType, "escort")));
  return <ReviewWritePage target={target ?? null} type="escort" profileHref={`/escort/${target?.username ?? username}`} bookingId={typeof sp.buchung === "string" ? sp.buchung : undefined} />;
}
