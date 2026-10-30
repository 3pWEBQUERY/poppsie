import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PreviewMedia, TargetPreview as Preview } from "@/lib/admin/preview";
import { TARGET_LABEL } from "@/lib/admin/labels";

/** Medien-Raster für Moderation (Staff darf über /api/media alle Medien sehen). */
export function MediaGrid({ items }: { items: PreviewMedia[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((m) => (
        <div key={m.id} className="relative overflow-hidden rounded-md border bg-muted">
          {m.kind === "image" ? (
            <a href={m.original} target="_blank" rel="noreferrer" title="Original öffnen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumb} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            </a>
          ) : m.kind === "video" ? (
            <video src={m.original} controls preload="metadata" className="aspect-square w-full bg-black object-contain" />
          ) : m.kind === "audio" ? (
            <audio src={m.original} controls className="w-full p-2" />
          ) : (
            <a href={m.original} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 text-xs">
              <FileText className="size-6" /> Datei
            </a>
          )}
          <span className="absolute top-1 left-1 flex gap-1">
            <Badge variant="secondary" className="px-1.5 text-[10px]">
              {m.purpose}
            </Badge>
            {m.status === "rejected" && <Badge className="px-1.5 text-[10px]">abgelehnt</Badge>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TargetPreview({ preview }: { preview: Preview }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{TARGET_LABEL[preview.type]}</Badge>
        <span className="text-sm font-semibold">{preview.heading}</span>
        {preview.state.map((s) => (
          <Badge key={s} variant={preview.removed ? "default" : "muted"}>
            {s}
          </Badge>
        ))}
        {preview.href && (
          <Link href={preview.href} target="_blank" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Öffentlich ansehen <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
      {preview.title && <p className="font-display text-base font-bold">{preview.title}</p>}
      {preview.body ? (
        <blockquote className="max-h-80 overflow-y-auto rounded-md border-l-2 border-l-border bg-background px-3 py-2 text-sm whitespace-pre-wrap">{preview.body}</blockquote>
      ) : (
        !preview.media.length && <p className="text-sm text-muted-foreground">{preview.exists ? "Kein Text." : "Der Inhalt wurde gelöscht."}</p>
      )}
      <MediaGrid items={preview.media} />
      {preview.meta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {preview.meta.map((m) => (
            <div key={m.label} className="contents">
              <dt className="text-muted-foreground">{m.label}</dt>
              <dd className="min-w-0 truncate">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-[11px] text-muted-foreground">ID {preview.id}</p>
    </div>
  );
}
