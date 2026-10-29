import Link from "next/link";
import { Fragment } from "react";

/**
 * Sicherer Renderer für Markdown-Light: **fett**, *kursiv*, [Text](https://…), @erwähnung, #hashtag, Zeilenumbrüche.
 * Es wird nie HTML interpretiert; alles wird als React-Text gerendert.
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]{1,200}\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|@[a-z0-9._]{3,20}|#[\p{L}0-9_]{2,40})/giu;

function renderLine(line: string, key: number) {
  const parts = line.split(TOKEN).filter((p) => p !== "");
  return (
    <Fragment key={key}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const md = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(p);
        if (md) return <ExternalLink key={i} href={md[2]!} label={md[1]!} />;
        if (/^https?:\/\//.test(p)) return <ExternalLink key={i} href={p} label={p.replace(/^https?:\/\//, "").slice(0, 60)} />;
        if (p.startsWith("@") && /^@[a-z0-9._]{3,20}$/i.test(p))
          return (
            <Link key={i} href={`/p/${p.slice(1).toLowerCase()}`} className="font-semibold text-primary hover:underline">
              {p}
            </Link>
          );
        if (p.startsWith("#") && p.length > 2)
          return (
            <Link key={i} href={`/feed?tag=${encodeURIComponent(p.slice(1).toLowerCase())}`} className="font-medium text-primary hover:underline">
              {p}
            </Link>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </Fragment>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary underline underline-offset-2">
      {label}
    </a>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderLine(line, i)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </div>
  );
}

/** Hashtags und Erwähnungen aus einem Text extrahieren (für die Speicherung). */
export function extractTags(text: string) {
  const hashtags = [...new Set([...text.matchAll(/#([\p{L}0-9_]{2,40})/gu)].map((m) => m[1]!.toLowerCase()))];
  const mentions = [...new Set([...text.matchAll(/@([a-z0-9._]{3,20})/gi)].map((m) => m[1]!.toLowerCase()))];
  return { hashtags, mentions };
}
