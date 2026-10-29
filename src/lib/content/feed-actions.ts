"use server";

import { z } from "zod";
import { parse } from "./validate";
import { ApiError, run } from "@/lib/auth/guards";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { canModerateGroup, canReadGroup, getMembership, groupById } from "@/lib/groups/access";
import { limitOrThrow } from "@/lib/rate-limit";
import { viewerCountries } from "@/lib/visibility";
import { countNewer, feedPage, type FeedPage, type FeedScope } from "./feed";

const ScopeInput = z.union([
  z.object({ kind: z.literal("feed"), tab: z.enum(["fuer-dich", "neueste"]), tag: z.string().max(41).nullish() }),
  z.object({ kind: z.literal("group"), groupId: z.uuid() }),
]);

async function resolveScope(viewer: SessionUser | null, raw: z.input<typeof ScopeInput>): Promise<FeedScope> {
  const scope = parse(ScopeInput, raw);
  if (scope.kind === "feed") return scope;
  const g = await groupById(scope.groupId);
  if (!g) throw new ApiError("NOT_FOUND");
  const m = await getMembership(g.id, viewer?.id);
  if (!canReadGroup(viewer, g, m)) throw new ApiError("NOT_FOUND");
  return { kind: "group", groupId: g.id, moderator: canModerateGroup(viewer, m) };
}

/** Nächste Seite für Infinite Scroll. */
export async function loadFeed(input: { scope: z.input<typeof ScopeInput>; cursor: string }) {
  return run(async (): Promise<FeedPage> => {
    const viewer = await getSessionUser();
    if (viewer) await limitOrThrow(`feed:${viewer.id}`, 240, 60);
    const scope = await resolveScope(viewer, input.scope);
    return feedPage(viewer, await viewerCountries(viewer), scope, parse(z.string().max(400), input.cursor));
  });
}

/** Erste Seite neu laden (nach Klick auf "X neue Beiträge"). */
export async function reloadFeed(input: { scope: z.input<typeof ScopeInput> }) {
  return run(async (): Promise<FeedPage> => {
    const viewer = await getSessionUser();
    const scope = await resolveScope(viewer, input.scope);
    return feedPage(viewer, await viewerCountries(viewer), scope, null);
  });
}

export async function countNewPosts(input: { scope: z.input<typeof ScopeInput>; since: string }) {
  return run(async () => {
    const viewer = await getSessionUser();
    if (viewer) await limitOrThrow(`feed-poll:${viewer.id}`, 30, 60);
    const scope = await resolveScope(viewer, input.scope);
    return { count: await countNewer(viewer, await viewerCountries(viewer), scope, parse(z.string().max(40), input.since)) };
  });
}
