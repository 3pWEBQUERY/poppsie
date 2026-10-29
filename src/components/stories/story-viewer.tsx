"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BadgeCheck, Eye, Heart, Loader2, MessageCircle, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/content/relative-time";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toggleReaction } from "@/lib/content/actions";
import type { Author } from "@/lib/content/types";
import { loadStories, markStoryViewed } from "@/lib/stories/actions";
import type { StoryView } from "@/lib/stories/types";
import { cn } from "@/lib/utils";
import { StoryCommentsSheet } from "./story-comments-sheet";
import { OverlayText, StickerLayer } from "./story-stickers";

const IMAGE_MS = 5000;

export type StorySource = { author: Author; highlights?: { title?: string | null; ids?: string[] } };

/**
 * Vollbild-Story-Viewer: Fortschrittsbalken, Tippen links/rechts, Halten zum Pausieren,
 * automatisch zur nächsten Autorin. Likes und Kommentare (Bottom-Sheet, Story pausiert).
 */
export function StoryViewer({ queue, start = 0, onClose, viewerId, onSeen }: { queue: StorySource[]; start?: number; onClose: () => void; viewerId: string; onSeen?: (authorId: string) => void }) {
  const [ai, setAi] = useState(start);
  const [si, setSi] = useState(0);
  const [cache, setCache] = useState<Record<string, StoryView[] | "error">>({});
  const [prog, setProg] = useState({ id: "", p: 0 });
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(0);
  const elapsed = useRef(0);
  const pressAt = useRef(0);
  const viewed = useRef(new Set<string>());
  const locked = useLockedHandler();

  const src = queue[ai];
  const key = src ? `${src.author.id}:${src.highlights ? JSON.stringify(src.highlights) : "a"}` : "";
  const list = cache[key];
  const stories = Array.isArray(list) ? list : null;
  const story = stories?.[si] ?? null;
  const paused = held || userPaused || sheet;

  // Stories der aktuellen Autorin laden (und die nächste vorladen).
  const requested = useRef(new Set<string>());
  useEffect(() => {
    for (const idx of [ai, ai + 1]) {
      const s = queue[idx];
      if (!s) continue;
      const k = `${s.author.id}:${s.highlights ? JSON.stringify(s.highlights) : "a"}`;
      if (requested.current.has(k)) continue;
      requested.current.add(k);
      loadStories({ authorId: s.author.id, highlights: Boolean(s.highlights), title: s.highlights?.title, ids: s.highlights?.ids }).then((r) =>
        setCache((cc) => ({ ...cc, [k]: r.ok ? r.data : "error" })),
      );
    }
  }, [ai, queue]);

  const next = useCallback(() => {
    if (stories && si < stories.length - 1) {
      setSi(si + 1);
    } else if (ai < queue.length - 1) {
      if (src) onSeen?.(src.author.id);
      setAi(ai + 1);
      setSi(0);
    } else {
      if (src) onSeen?.(src.author.id);
      onClose();
    }
  }, [stories, si, ai, queue.length, onClose, onSeen, src]);

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (ai > 0) {
      setAi(ai - 1);
      setSi(0);
    }
  }, [si, ai]);

  // Fortschritt / Timer.
  const storyId = story?.id;
  const storyKind = story?.kind;
  const storyAuthor = story?.authorId;
  const progress = prog.id === storyId ? prog.p : 0;
  useEffect(() => {
    if (!storyId) return;
    elapsed.current = 0;
    if (!viewed.current.has(storyId)) {
      viewed.current.add(storyId);
      if (storyAuthor !== viewerId) void markStoryViewed(storyId);
    }
  }, [storyId, storyAuthor, viewerId]);

  useEffect(() => {
    if (!storyId || paused) {
      if (storyKind === "video") videoRef.current?.pause();
      return;
    }
    if (storyKind === "video") {
      const v = videoRef.current;
      void v?.play().catch(() => {});
      let raf = 0;
      const tick = () => {
        if (v && v.duration) setProg({ id: storyId, p: Math.min(1, v.currentTime / Math.min(v.duration, 30)) });
        if (v && v.currentTime >= 30) return next();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    startedAt.current = performance.now();
    let raf = 0;
    const tick = () => {
      const p = (elapsed.current + performance.now() - startedAt.current) / IMAGE_MS;
      if (p >= 1) return next();
      setProg({ id: storyId, p });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      elapsed.current += performance.now() - startedAt.current;
    };
  }, [storyId, storyKind, paused, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setUserPaused((p) => !p);
      }
    };
    const onVis = () => document.hidden && setUserPaused(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose, sheet]);

  const updateStory = (patch: Partial<StoryView>) =>
    setCache((c) => {
      const l = c[key];
      if (!Array.isArray(l)) return c;
      return { ...c, [key]: l.map((s, i) => (i === si ? { ...s, ...patch } : s)) };
    });

  const like = async () => {
    if (!story) return;
    const liked = story.reactions.mine;
    updateStory({ reactions: { ...story.reactions, mine: liked ? null : "love", total: story.reactions.total + (liked ? -1 : 1) } });
    const res = await toggleReaction({ targetType: "story", targetId: story.id, kind: liked ?? "love" });
    if (!res.ok) {
      updateStory({ reactions: story.reactions });
      if (!locked(res)) toast.error(res.error);
    } else updateStory({ reactions: res.data });
  };

  if (!src || typeof document === "undefined") return null;
  const own = src.author.id === viewerId;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={`Story von ${src.author.name}`}>
      <div className="relative flex h-full w-full max-w-[min(100vw,56.25vh)] flex-col overflow-hidden bg-neutral-900 sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-xl">
        {/* Fortschrittsbalken */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-2 pt-2">
          {(stories ?? [null]).map((_, i) => (
            <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        {/* Kopfzeile */}
        <div className="absolute inset-x-0 top-3 z-20 flex items-center gap-2 px-3 pt-2">
          <Link href={src.author.href} className="flex min-w-0 items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <UserAvatar user={src.author} size="xs" />
            <span className="truncate text-sm font-semibold text-white">{src.author.name}</span>
            {src.author.verified && <BadgeCheck className="size-4 shrink-0 text-white" />}
          </Link>
          {story && <RelativeTime iso={story.createdAt} className="shrink-0 text-xs text-white/70" />}
          {src.highlights && story?.highlightTitle && <span className="truncate text-xs text-white/70">· {story.highlightTitle}</span>}
          <div className="ml-auto flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {story?.kind === "video" && (
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Ton an" : "Ton aus"} className="rounded-full p-1.5 text-white hover:bg-white/10">
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            )}
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={paused ? "Fortsetzen" : "Pausieren"} className="rounded-full p-1.5 text-white hover:bg-white/10">
              {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            <button type="button" onClick={onClose} aria-label="Schliessen" className="rounded-full p-1.5 text-white hover:bg-white/10">
              <X className="size-6" />
            </button>
          </div>
        </div>

        {/* Medium + Tap-Zonen */}
        <div
          className="relative flex flex-1 touch-none items-center justify-center select-none"
          onPointerDown={() => {
            pressAt.current = Date.now();
            setHeld(true);
          }}
          onPointerUp={(e) => {
            setHeld(false);
            if (Date.now() - pressAt.current > 250) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width / 3) prev();
            else next();
          }}
          onPointerLeave={() => setHeld(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {list === undefined && <Loader2 className="size-8 animate-spin text-white/60" />}
          {list === "error" && <p className="text-sm text-white/70">Story nicht verfügbar</p>}
          {stories?.length === 0 && <p className="text-sm text-white/70">Keine aktiven Stories</p>}
          {story?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={story.id} src={story.url} alt="" draggable={false} className="max-h-full w-full object-contain" />
          )}
          {story?.kind === "video" && <video key={story.id} ref={videoRef} src={story.url} playsInline muted={muted} onEnded={next} className="max-h-full w-full object-contain" />}
          {story?.overlayText && <OverlayText text={story.overlayText} />}
          {story && <StickerLayer stickers={story.stickers} bookHref={story.bookHref} />}
        </div>

        {/* Fusszeile */}
        {story && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-3 pt-6 pb-4" onPointerDown={(e) => e.stopPropagation()}>
            {own ? (
              <Link href="/dashboard/stories" className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-xs font-semibold text-white hover:bg-black/70">
                <Eye className="size-4" /> Viewer & Statistik
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="h-10 flex-1 rounded-full border border-white/40 bg-black/30 px-4 text-left text-sm text-white/80 hover:bg-black/50"
              >
                Kommentieren …
              </button>
            )}
            {own && <span className="flex-1" />}
            <button type="button" onClick={() => setSheet(true)} aria-label="Kommentare" className="flex items-center gap-1 rounded-full p-2 text-white hover:bg-white/10">
              <MessageCircle className="size-6" />
              {story.commentCount > 0 && <span className="text-xs font-semibold">{story.commentCount}</span>}
            </button>
            <button type="button" onClick={like} disabled={own} aria-label={story.reactions.mine ? "Like entfernen" : "Liken"} className="flex items-center gap-1 rounded-full p-2 text-white hover:bg-white/10 disabled:opacity-80">
              <Heart className={cn("size-6", story.reactions.mine && "fill-primary text-primary")} />
              {story.reactions.total > 0 && <span className="text-xs font-semibold">{story.reactions.total}</span>}
            </button>
          </div>
        )}
      </div>
      {story && <StoryCommentsSheet storyId={story.id} open={sheet} onOpenChange={setSheet} onAdded={() => updateStory({ commentCount: story.commentCount + 1 })} />}
    </div>,
    document.body,
  );
}
