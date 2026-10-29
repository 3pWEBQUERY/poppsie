import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { PostCard } from "@/components/content/post-card";
import { ContentViewerProvider } from "@/components/content/viewer-context";
import { getSessionUser } from "@/lib/auth/session";
import { getPost, postAccess } from "@/lib/content/access";
import { hydratePosts } from "@/lib/content/hydrate";
import { contentViewer } from "@/lib/content/viewer";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Beitrag" };

export default async function PostPage(props: PageProps<"/feed/[postId]">) {
  const { postId } = await props.params;
  const user = await getSessionUser();
  const p = await getPost(postId);
  if (!p || p.isDraft) notFound();
  if (p.context === "forum" && p.threadId) redirect(`/forum/thread/${p.threadId}?beitrag=${p.id}`);
  const countries = await viewerCountries(user);
  const access = await postAccess(user, p, countries);
  if (!access.canView) notFound();
  const [[view], viewer] = await Promise.all([hydratePosts([p], user, { countries, moderator: access.moderator }), contentViewer(user)]);
  const [group] = p.groupId ? await db.select({ name: groups.name, slug: groups.slug }).from(groups).where(eq(groups.id, p.groupId)) : [];

  return (
    <ContentViewerProvider viewer={viewer}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <Link href={group ? `/gruppen/${group.slug}` : "/feed"} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {group ? `Zur Gruppe ${group.name}` : "Zum Newsfeed"}
        </Link>
        <PostCard
          post={view!}
          commentsOpen
          canInteract={access.canInteract}
          context={
            group ? (
              <span>
                · in{" "}
                <Link href={`/gruppen/${group.slug}`} className="font-medium text-foreground hover:underline">
                  {group.name}
                </Link>
              </span>
            ) : undefined
          }
        />
      </div>
    </ContentViewerProvider>
  );
}
