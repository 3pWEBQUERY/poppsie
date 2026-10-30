import "server-only";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { posts } from "@/db/schema";
import { visibleToSql } from "@/lib/visibility";

/** Gelöscht/Entwurf ausblenden, gesperrte/ausgeblendete/blockierte Autoren ausblenden. */
export function livePostSql(viewerId: string | null, countries: string[]): SQL {
  return and(isNull(posts.deletedAt), eq(posts.isDraft, false), visibleToSql(posts.authorId, viewerId, countries))!;
}

/** Freigabe (Vorab-Moderation in Gruppen): eigene, noch nicht freigegebene Beiträge sieht der Autor. */
export function approvedSql(viewerId: string | null): SQL {
  return viewerId ? or(eq(posts.approved, true), eq(posts.authorId, viewerId))! : eq(posts.approved, true);
}

/** Post-Sichtbarkeit (öffentlich, nur Follower, nur registrierte Mitglieder). */
export function audienceSql(viewerId: string | null): SQL {
  if (!viewerId) return eq(posts.visibility, "public");
  return sql`(${posts.visibility} IN ('public', 'members') OR ${posts.authorId} = ${viewerId}
    OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId} AND f.followee_id = ${posts.authorId}))`;
}
