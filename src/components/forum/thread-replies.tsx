"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Composer } from "@/components/content/composer";
import { useContentViewer } from "@/components/content/viewer-context";
import type { PostView } from "@/lib/content/types";
import { replyToThread } from "@/lib/forum/actions";
import { ForumPost } from "./forum-post";

/** Beiträge einer Themenseite plus "Beitrag schreiben"-Composer mit Zitat-Funktion. */
export function ThreadReplies({
  threadId,
  initial,
  offset,
  canReply,
  locked,
  firstPostId,
  page,
  pages,
  writeHint,
}: {
  threadId: string;
  initial: PostView[];
  offset: number;
  canReply: boolean;
  locked: boolean;
  firstPostId: string | null;
  page: number;
  pages: number;
  writeHint?: string | null;
}) {
  const viewer = useContentViewer();
  const router = useRouter();
  const [posts, setPosts] = useState(initial);
  const [quote, setQuote] = useState<PostView | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const startQuote = (p: PostView) => {
    setQuote(p);
    box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => textarea.current?.focus(), 350);
  };

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p, i) => (
        <ForumPost
          key={p.id}
          post={p}
          index={offset + i + 1}
          opening={p.id === firstPostId}
          canReply={canReply}
          onQuote={startQuote}
          onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))}
        />
      ))}

      <div ref={box} id="antworten" className="scroll-mt-32">
        {!viewer ? (
          <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            <Link href={`/anmelden?next=/forum/thread/${threadId}`} className="font-semibold text-primary hover:underline">
              Melde dich an
            </Link>{" "}
            um mitzudiskutieren.
          </div>
        ) : !canReply ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
            <Lock className="size-4" /> {locked ? "Dieses Thema ist geschlossen." : (writeHint ?? "Du kannst in diesem Bereich nicht schreiben.")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-bold">Beitrag schreiben</h2>
            <Composer
              context="forum"
              threadId={threadId}
              textareaRef={textarea}
              placeholder="Deine Antwort …"
              submitLabel="Antworten"
              drafts
              storageKey={`thread:${threadId}`}
              quote={quote ? { id: quote.id, name: quote.author.name, excerpt: quote.body.slice(0, 200) } : null}
              onClearQuote={() => setQuote(null)}
              onSubmit={async (p) => {
                const res = await replyToThread({ threadId, body: p.body, mediaIds: p.mediaIds, embeds: p.embeds, quoteId: quote?.id ?? null, draftId: p.draftId });
                if (res.ok) {
                  setQuote(null);
                  if (res.data.page === page && page >= pages) setPosts((l) => [...l, res.data.post]);
                  else router.push(`/forum/thread/${threadId}?seite=${res.data.page}#p-${res.data.post.id}`);
                }
                return res;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
