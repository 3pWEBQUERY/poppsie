import type { SessionUser } from "@/lib/auth/session";
import { toAuthor } from "@/lib/content/hydrate";
import { usersWithActiveStory } from "@/lib/stories/active";
import { highlightGroups } from "@/lib/stories/queries";
import { getSummary } from "@/lib/users/summary";
import { viewerCountries } from "@/lib/visibility";
import { ProfileStoriesClient } from "./profile-stories-client";

/** Story-Highlights und "Story ansehen" auf Profilseiten (Sichtbarkeit wird beachtet). */
export async function ProfileStories({ userId, viewer }: { userId: string; viewer: SessionUser | null }) {
  const countries = await viewerCountries(viewer);
  const [active, highlights, summary] = await Promise.all([usersWithActiveStory([userId]), highlightGroups(userId, viewer, countries), getSummary(userId, viewer)]);
  if (!summary) return null;
  const hasActive = active.has(userId);
  if (!hasActive && !highlights.length) return null;
  return <ProfileStoriesClient author={toAuthor(summary)} hasActive={hasActive} highlights={highlights} viewerId={viewer?.id ?? null} />;
}
