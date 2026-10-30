"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { searchMentions } from "@/lib/content/actions";
import type { MentionHit } from "@/lib/content/types";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "ref"> & {
  value: string;
  onChange: (v: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  minRows?: number;
  maxHeight?: number;
};

const TYPE_LABEL: Record<string, string> = { escort: "Escort", club: "Club", member: "Mitglied" };

/** Textfeld mit @-Autovervollständigung (Benutzernamen) und automatischer Höhe. */
export function MentionTextarea({ value, onChange, textareaRef, minRows = 2, maxHeight = 360, className, onKeyDown, ...rest }: Props) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? own;
  const [query, setQuery] = useState<string | null>(null);
  const [hits, setHits] = useState<MentionHit[]>([]);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, ref, maxHeight]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query === null) return;
    timer.current = setTimeout(async () => {
      const res = await searchMentions(query);
      if (res.ok) {
        setHits(res.data);
        setActive(0);
      }
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const detect = (el: HTMLTextAreaElement) => {
    const before = el.value.slice(0, el.selectionStart ?? 0);
    const m = /(?:^|\s)@([a-z0-9._]{1,20})$/i.exec(before);
    setQuery(m ? m[1]!.toLowerCase() : null);
    if (!m) setHits([]);
  };

  const pick = (h: MentionHit) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([a-z0-9._]{1,20})$/i, `@${h.username} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    setHits([]);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const open = query !== null && hits.length > 0;
  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={minRows}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target);
        }}
        onClick={(e) => detect(e.currentTarget)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % hits.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + hits.length) % hits.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(hits[active]!);
              return;
            }
            if (e.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          onKeyDown?.(e);
        }}
        aria-autocomplete="list"
        className={cn("w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground", className)}
        {...rest}
      />
      {open && (
        <ul role="listbox" aria-label="Erwähnen" className="absolute top-full left-0 z-30 mt-1 w-72 overflow-hidden rounded-md border bg-popover py-1">
          {hits.map((h, i) => (
            <li key={h.username} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === active && "bg-accent")}
              >
                <UserAvatar user={{ name: h.name, avatarUrl: h.avatarUrl }} size="xs" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{h.name}</span> <span className="text-muted-foreground">@{h.username}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[h.accountType]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
