import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media/urls";
import { getSummary } from "@/lib/users/summary";
import { canAdminGroup, canModerateGroup, canPostInGroup, canReadGroup, canSeeGroup, getMembership, groupBySlug } from "./access";

/** Gruppe + Mitgliedschaft + Rechte für Layout und Unterseiten (pro Request gecacht). */
export const loadGroupPage = cache(async (slug: string) => {
  const user = await getSessionUser();
  const g = await groupBySlug(slug);
  if (!g) notFound();
  const m = await getMembership(g.id, user?.id);
  if (!canSeeGroup(user, g, m)) notFound();
  const owner = await getSummary(g.ownerId, user);
  return {
    user,
    group: g,
    membership: m,
    owner,
    coverUrl: g.coverMediaId ? mediaUrl(g.coverMediaId, "o") : null,
    can: {
      read: canReadGroup(user, g, m),
      post: canPostInGroup(m),
      moderate: canModerateGroup(user, m),
      admin: canAdminGroup(user, m),
      owner: m?.status === "active" && m.role === "owner",
    },
  };
});
