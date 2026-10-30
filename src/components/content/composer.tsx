"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Globe, Loader2, Lock, Quote, Save, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/shared/media-uploader";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Select } from "@/components/shared/select/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { resolveLink, saveDraft } from "@/lib/content/actions";
import { findUrls, parsePoppsieLink } from "@/lib/content/links";
import { MAX_BODY, MAX_MEDIA, VISIBILITY_LABELS, type DraftView, type EmbedPreview, type EmbedRef, type Visibility } from "@/lib/content/types";
import type { ActionResult } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { ComposerToolbar } from "./composer-toolbar";
import { DraftMenu } from "./draft-menu";
import { EmbedCard } from "./embed-card";
import { MentionTextarea } from "./mention-textarea";
import { useContentViewer } from "./viewer-context";

export type ComposerPayload = { body: string; mediaIds: string[]; embeds: EmbedRef[]; visibility: Visibility; draftId?: string };
export type ComposerInitial = { body: string; media: UploadedMedia[]; embeds: EmbedPreview[]; visibility?: Visibility };

const VIS_OPTIONS = (["public", "followers", "members"] as const).map((v) => ({
  value: v,
  label: VISIBILITY_LABELS[v],
  icon: v === "public" ? <Globe /> : v === "followers" ? <Users /> : <Lock />,
}));

type Props = {
  context: "feed" | "group" | "forum";
  groupId?: string | null;
  threadId?: string | null;
  placeholder?: string;
  submitLabel?: string;
  showVisibility?: boolean;
  drafts?: boolean;
  /** Lokales Zwischenspeichern des Textes (bei Absturz/Neuladen). */
  storageKey?: string;
  initial?: ComposerInitial;
  quote?: { id: string; name: string; excerpt: string } | null;
  onClearQuote?: () => void;
  onSubmit: (p: ComposerPayload) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
  onCancel?: () => void;
  /** Zuerst einzeilig, klappt beim Fokussieren auf (Feed). */
  collapsible?: boolean;
  autoFocus?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

/** Gemeinsamer Composer für Feed, Gruppen und Forum. */
export function Composer(props: Props) {
  const viewer = useContentViewer();
  const locked = useLockedHandler();
  const [body, setBody] = useState(props.initial?.body ?? "");
  const [media, setMedia] = useState<UploadedMedia[]>(props.initial?.media ?? []);
  const [embeds, setEmbeds] = useState<EmbedPreview[]>(props.initial?.embeds ?? []);
  const [visibility, setVisibility] = useState<Visibility>(props.initial?.visibility ?? "public");
  const [showMedia, setShowMedia] = useState((props.initial?.media.length ?? 0) > 0);
  const [expanded, setExpanded] = useState(!props.collapsible || Boolean(props.initial));
  const [draftId, setDraftId] = useState<string | undefined>();
  const [draftKey, setDraftKey] = useState(0);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = props.textareaRef ?? ownRef;
  const dismissed = useRef(new Set<string>());
  const resolving = useRef(new Set<string>());

  // Lokale Sicherung wiederherstellen.
  useEffect(() => {
    if (!props.storageKey || props.initial) return;
    try {
      const saved = localStorage.getItem(`pp:composer:${props.storageKey}`);
      if (saved) {
        // Nach der Hydration aus dem lokalen Speicher übernehmen (externes System).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBody(saved);
        setExpanded(true);
      }
    } catch {}
  }, [props.storageKey, props.initial]);

  useEffect(() => {
    if (!props.storageKey || props.initial) return;
    const t = setTimeout(() => {
      try {
        if (body) localStorage.setItem(`pp:composer:${props.storageKey}`, body);
        else localStorage.removeItem(`pp:composer:${props.storageKey}`);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [body, props.storageKey, props.initial]);

  // Poppsie-Links im Text automatisch als Vorschaukarte einbetten.
  useEffect(() => {
    const t = setTimeout(() => {
      const hosts = [window.location.host];
      for (const url of findUrls(body)) {
        const ref = parsePoppsieLink(url, hosts);
        if (!ref) continue;
        const key = `${ref.type}:${ref.key}`;
        if (dismissed.current.has(key) || resolving.current.has(key)) continue;
        resolving.current.add(key);
        resolveLink(url).then((res) => {
          if (res.ok && res.data) {
            const e = res.data;
            setEmbeds((list) => (list.some((x) => x.type === e.type && x.id === e.id) || list.length >= 5 ? list : [...list, e]));
          }
        });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [body]);

  if (!viewer) return null;

  const edit = (fn: (text: string, s: number, e: number) => { text: string; caret: [number, number] }) => {
    const el = ref.current;
    const s = el?.selectionStart ?? body.length;
    const e = el?.selectionEnd ?? body.length;
    const res = fn(body, s, e);
    setBody(res.text.slice(0, MAX_BODY));
    setExpanded(true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(res.caret[0], res.caret[1]);
    });
  };

  const reset = () => {
    setBody("");
    setMedia([]);
    setEmbeds([]);
    setShowMedia(false);
    setDraftId(undefined);
    dismissed.current.clear();
    resolving.current.clear();
    if (props.collapsible) setExpanded(false);
    try {
      if (props.storageKey) localStorage.removeItem(`pp:composer:${props.storageKey}`);
    } catch {}
  };

  const empty = !body.trim() && media.length === 0 && embeds.length === 0;
  const submit = () => {
    if (empty || pending) return;
    start(async () => {
      const res = await props.onSubmit({ body, mediaIds: media.map((m) => m.id), embeds: embeds.map((e) => ({ type: e.type, id: e.id })), visibility, draftId });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      if (!props.initial) reset();
      props.onDone?.();
    });
  };

  const save = async () => {
    if (empty) return;
    setSaving(true);
    const res = await saveDraft({ id: draftId, context: props.context, groupId: props.groupId, threadId: props.threadId, body, mediaIds: media.map((m) => m.id) });
    setSaving(false);
    if (!res.ok) {
      if (!locked(res)) toast.error(res.error);
      return;
    }
    setDraftId(res.data.id);
    setDraftKey((k) => k + 1);
    toast.success("Entwurf gespeichert");
  };

  const loadDraft = (d: DraftView) => {
    setBody(d.body);
    setMedia(d.media.map((m) => ({ ...m })));
    setShowMedia(d.media.length > 0);
    setDraftId(d.id);
    setExpanded(true);
  };

  return (
    <div
      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", props.className)}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          setShowMedia(true);
          setExpanded(true);
        }
      }}
    >
      {props.quote && (
        <div className="flex items-start gap-2 rounded-md border-l-2 border-l-primary bg-background/50 px-3 py-2 text-xs">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{props.quote.name}</span> schrieb:
            <p className="line-clamp-2 text-muted-foreground">{props.quote.excerpt}</p>
          </div>
          <button type="button" aria-label="Zitat entfernen" onClick={props.onClearQuote} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex gap-3">
        {!props.initial && <UserAvatar user={viewer} size="sm" className="mt-0.5" />}
        <div className="min-w-0 flex-1" onFocus={() => setExpanded(true)}>
          <MentionTextarea
            textareaRef={ref}
            value={body}
            onChange={(v) => setBody(v.slice(0, MAX_BODY))}
            placeholder={props.placeholder ?? "Was möchtest du teilen?"}
            minRows={expanded ? 3 : 1}
            autoFocus={props.autoFocus}
            aria-label={props.placeholder ?? "Beitrag schreiben"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="py-1.5"
          />
        </div>
      </div>

      {embeds.length > 0 && (
        <div className="flex flex-col gap-2">
          {embeds.map((e) => (
            <EmbedCard
              key={`${e.type}:${e.id}`}
              e={e}
              onRemove={() => {
                setEmbeds((l) => l.filter((x) => !(x.type === e.type && x.id === e.id)));
                for (const url of findUrls(body)) {
                  const r = parsePoppsieLink(url, [window.location.host]);
                  if (r) dismissed.current.add(`${r.type}:${r.key}`);
                }
              }}
            />
          ))}
        </div>
      )}

      {expanded && showMedia && <MediaUploader purpose="post" value={media} onChange={setMedia} max={MAX_MEDIA} label="Bilder/Videos hierher ziehen oder auswählen" />}

      {expanded && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <ComposerToolbar edit={edit} onMedia={() => setShowMedia((s) => !s)} mediaActive={showMedia} mediaCount={media.length} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {body.length > MAX_BODY * 0.8 && (
              <span className={cn("text-[11px]", body.length >= MAX_BODY ? "text-destructive" : "text-muted-foreground")}>
                {body.length}/{MAX_BODY}
              </span>
            )}
            {props.drafts && !props.initial && (
              <>
                <DraftMenu context={props.context} groupId={props.groupId} threadId={props.threadId} onLoad={loadDraft} refreshKey={draftKey} />
                <button
                  type="button"
                  onClick={save}
                  disabled={empty || saving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Speichern
                </button>
              </>
            )}
            {props.showVisibility && (
              <Select options={VIS_OPTIONS} value={visibility} onChange={(v) => v && setVisibility(v as Visibility)} aria-label="Sichtbarkeit" className="h-8 w-44 text-xs" />
            )}
            {props.onCancel && (
              <Button size="sm" variant="ghost" onClick={props.onCancel}>
                Abbrechen
              </Button>
            )}
            <Button size="sm" onClick={submit} disabled={empty || pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              {props.submitLabel ?? "Posten"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
