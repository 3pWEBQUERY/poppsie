"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Clock, Flag, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReportDialog } from "@/components/shared/report-dialog";
import { StarRating } from "@/components/shared/star-rating";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { commentOnReview, replyToReview } from "@/lib/reviews/actions";
import { reviewDurationLabel, type Criterion } from "@/lib/reviews/criteria";
import type { ReplyItem, ReviewItem } from "@/lib/reviews/queries";

export type ReviewViewer = { id: string; accountType: "member" | "escort" | "club" } | null;

function fmtDay(d: string) {
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d));
}

const fallbackUser = { name: "Gelöschtes Konto", avatarUrl: null };

/** Bericht im kaufmich-Stil: Kopf mit Avatar, Titel, Autor, Sternen, Treffen; Text in hellem Rahmen; Antwort eingerückt. */
export function ReviewCard({ item, viewer, criteria, showTarget = false }: { item: ReviewItem; viewer: ReviewViewer; criteria: Criterion[]; showTarget?: boolean }) {
  const router = useRouter();
  const handleLocked = useLockedHandler();
  const [pending, start] = useTransition();
  const [replyBody, setReplyBody] = useState("");
  const [replyTitle, setReplyTitle] = useState("");
  const [replyRating, setReplyRating] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const isOwner = viewer?.id === item.targetId;
  const author = item.author ?? fallbackUser;

  const submitReply = () =>
    start(async () => {
      const res = await replyToReview({ reviewId: item.id, body: replyBody, title: replyTitle || undefined, rating: replyRating || undefined });
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success("Antwort veröffentlicht");
      router.refresh();
    });

  const submitComment = () =>
    start(async () => {
      const res = await commentOnReview({ reviewId: item.id, body: comment });
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      setComment("");
      setCommentOpen(false);
      router.refresh();
    });

  const sub = criteria.filter((c) => item.ratings[c.key]);

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5" id={`bericht-${item.id}`}>
      <header className="flex gap-3">
        <UserAvatar user={author} size="md" link />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-base font-bold">{item.title || "Bericht"}</h3>
            {item.verified && (
              <Badge variant="success">
                <BadgeCheck /> Verifiziertes Treffen
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            von{" "}
            {item.author ? (
              <Link href={item.author.href} className="font-medium text-foreground hover:underline">
                {item.author.name}
              </Link>
            ) : (
              author.name
            )}
            {showTarget && item.target && (
              <>
                {" "}über{" "}
                <Link href={item.target.href} className="font-medium text-foreground hover:underline">
                  {item.target.name}
                </Link>
              </>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <StarRating value={item.rating} />
            {item.meetingDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Treffen am {fmtDay(item.meetingDate)}
              </span>
            )}
            {reviewDurationLabel(item.durationMin) && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {reviewDurationLabel(item.durationMin)}
              </span>
            )}
          </div>
        </div>
        <time className="hidden shrink-0 text-xs text-muted-foreground sm:block" dateTime={item.createdAt}>
          {fmtDay(item.createdAt)}
        </time>
      </header>

      {sub.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {sub.map((c) => (
            <div key={c.key} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">{c.label}</dt>
              <dd>
                <StarRating value={item.ratings[c.key]!} size="xs" label={c.label} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="rounded-md border border-foreground/15 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{item.body}</div>

      {item.ownerReply && <OwnerReply reply={item.ownerReply} />}

      {isOwner && !item.ownerReply && (
        <div className="ml-4 flex flex-col gap-2 border-l-2 border-primary pl-4 sm:ml-10">
          <span className="text-sm font-semibold">Öffentlich antworten (einmalig)</span>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={replyTitle} onChange={(e) => setReplyTitle(e.target.value)} placeholder="Titel (optional)" maxLength={120} className="max-w-xs" />
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              Deine Bewertung <StarRating value={replyRating} onChange={setReplyRating} label="Deine Bewertung" />
            </span>
          </div>
          <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Deine Antwort …" maxLength={3000} rows={3} />
          <Button size="sm" className="self-start" disabled={pending || replyBody.trim().length < 2} onClick={submitReply}>
            Antwort veröffentlichen
          </Button>
        </div>
      )}

      {item.comments.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 sm:ml-10">
          {item.comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <UserAvatar user={c.author ?? fallbackUser} size="xs" link />
              <div className="min-w-0 rounded-md bg-muted px-3 py-2">
                <span className="text-xs font-semibold">{c.author?.name ?? fallbackUser.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{fmtDay(c.createdAt)}</span>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewer && (
        <footer className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCommentOpen((o) => !o)}>
            <MessageSquare /> Kommentieren
          </Button>
          {viewer.id !== item.author?.id && (
            <ReportDialog
              targetType="review"
              targetId={item.id}
              targetUserId={item.author?.id}
              trigger={
                <Button variant="ghost" size="sm">
                  <Flag /> Melden
                </Button>
              }
            />
          )}
        </footer>
      )}
      {commentOpen && (
        <div className="flex flex-col gap-2">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Dein Kommentar …" maxLength={2000} rows={2} />
          <Button size="sm" variant="secondary" className="self-start" disabled={pending || comment.trim().length < 2} onClick={submitComment}>
            Kommentar senden
          </Button>
        </div>
      )}
    </article>
  );
}

function OwnerReply({ reply }: { reply: ReplyItem }) {
  const a = reply.author ?? fallbackUser;
  return (
    <div className="ml-4 flex gap-3 border-l-2 border-primary pl-4 sm:ml-10">
      <UserAvatar user={a} size="sm" link />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-display text-sm font-bold">{reply.title || `Antwort von ${a.name}`}</span>
          {reply.rating ? <StarRating value={reply.rating} size="xs" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {a.name} · {fmtDay(reply.createdAt)}
        </p>
        <p className="mt-1.5 text-sm whitespace-pre-wrap">{reply.body}</p>
      </div>
    </div>
  );
}
