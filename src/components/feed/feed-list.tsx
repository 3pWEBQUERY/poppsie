"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Composer } from "@/components/content/composer";
import { PostCard } from "@/components/content/post-card";
import { useContentViewer } from "@/components/content/viewer-context";
import { createPost } from "@/lib/content/actions";
import { countNewPosts, loadFeed, reloadFeed } from "@/lib/content/feed-actions";
import type { PostView } from "@/lib/content/types";

type Scope = { kind: "feed"; tab: "fuer-dich" | "neueste"; tag?: string | null } | { kind: "group"; groupId: string };
type Page = { posts: PostView[]; nextCursor: string | null; asOf: string };

/**
 * Feed mit Infinite Scroll (Cursor) und "X neue Beiträge"-Pill: neue Beiträge werden alle 30 s
 * gezählt und erst nach Klick eingeblendet, damit die Liste nicht springt.
 * Beim Wechsel von Tab/Filter mit neuem `key` rendern.
 */
export function FeedList({
  scope,
  initial,
  composer,
  emptyText = "Noch keine Beiträge.",
  postContext,
}: {
  scope: Scope;
  initial: Page;
  composer?: { placeholder?: string; showVisibility?: boolean; canPost: boolean; hint?: string };
  emptyText?: string;
  postContext?: React.ReactNode;
}) {
  const viewer = useContentViewer();
  const [posts, setPosts] = useState(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [since, setSince] = useState(initial.asOf);
  const [fresh, setFresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const scopeKey = JSON.stringify(scope);

  const more = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const res = await loadFeed({ scope: JSON.parse(scopeKey), cursor });
    setLoading(false);
    if (!res.ok) return void toast.error(res.error);
    setPosts((p) => {
      const seen = new Set(p.map((x) => x.id));
      return [...p, ...res.data.posts.filter((x) => !seen.has(x.id))];
    });
    setCursor(res.data.nextCursor);
  }, [cursor, loading, scopeKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more]);

  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      const res = await countNewPosts({ scope: JSON.parse(scopeKey), since });
      if (res.ok) setFresh(res.data.count);
    };
    const t = setInterval(poll, 30_000);
    const onRt = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "feed.new") void poll();
    };
    window.addEventListener("pp:realtime", onRt);
    return () => {
      clearInterval(t);
      window.removeEventListener("pp:realtime", onRt);
    };
  }, [scopeKey, since]);

  const showFresh = async () => {
    const res = await reloadFeed({ scope: JSON.parse(scopeKey) });
    if (!res.ok) return void toast.error(res.error);
    setPosts(res.data.posts);
    setCursor(res.data.nextCursor);
    setSince(res.data.asOf);
    setFresh(0);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={top} className="scroll-mt-28" />
      {viewer && composer?.canPost && (
        <Composer
          context={scope.kind === "group" ? "group" : "feed"}
          groupId={scope.kind === "group" ? scope.groupId : null}
          placeholder={composer.placeholder}
          showVisibility={composer.showVisibility}
          drafts
          collapsible
          storageKey={scope.kind === "group" ? `group:${scope.groupId}` : "feed"}
          onSubmit={async (p) => {
            const res = await createPost({ context: scope.kind === "group" ? "group" : "feed", groupId: scope.kind === "group" ? scope.groupId : undefined, ...p });
            if (res.ok) {
              setPosts((list) => [res.data, ...list]);
              if (!res.data.approved) toast.success("Dein Beitrag wird nach der Freigabe sichtbar.");
            }
            return res;
          }}
        />
      )}
      {composer?.hint && <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-center text-xs text-muted-foreground">{composer.hint}</p>}

      {fresh > 0 && (
        <div className="sticky top-28 z-20 flex justify-center">
          <button type="button" onClick={showFresh} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
            <ArrowUp className="size-3.5" /> {fresh === 1 ? "1 neuer Beitrag" : `${fresh} neue Beiträge`}
          </button>
        </div>
      )}

      {posts.length === 0 && <p className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">{emptyText}</p>}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} context={postContext} onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
      ))}
      <div ref={sentinel} aria-hidden />
      {loading && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      {!cursor && posts.length > 5 && <p className="py-4 text-center text-xs text-muted-foreground">Du hast alles gesehen.</p>}
    </div>
  );
}
