import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StoryAutoplay } from "@/components/stories/story-autoplay";
import { requirePageUser } from "@/lib/auth/guards";
import { toAuthor } from "@/lib/content/hydrate";
import { isActiveStory, storyAccess } from "@/lib/stories/access";
import { getSummary } from "@/lib/users/summary";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Story" };

export default async function StoryPage(props: PageProps<"/stories/[id]">) {
  const { id } = await props.params;
  const user = await requirePageUser({ next: `/stories/${id}` });
  const s = await storyAccess(user, id, await viewerCountries(user));
  if (!s) notFound();
  const author = await getSummary(s.authorId, user);
  if (!author) notFound();
  const active = isActiveStory(s);
  const source = active && !s.highlight ? { author: toAuthor(author) } : { author: toAuthor(author), highlights: { title: s.highlightTitle } };
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <StoryAutoplay source={source} viewerId={user.id} label={s.highlight ? `Highlight „${s.highlightTitle ?? "Highlights"}“ von ${author.name}` : `Story von ${author.name}`} />
    </div>
  );
}
