"use client";

import { useState } from "react";
import { AtSign, Bold, Hash, ImagePlus, Italic, Link2 } from "lucide-react";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Edit = (fn: (text: string, start: number, end: number) => { text: string; caret: [number, number] }) => void;

const btn = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

/** Werkzeugleiste: fett, kursiv, Link, @, #, Emoji, Medien. */
export function ComposerToolbar({ edit, onMedia, mediaActive, mediaCount }: { edit: Edit; onMedia?: () => void; mediaActive?: boolean; mediaCount?: number }) {
  const wrap = (mark: string, placeholder: string) =>
    edit((t, s, e) => {
      const sel = t.slice(s, e) || placeholder;
      const text = t.slice(0, s) + mark + sel + mark + t.slice(e);
      return { text, caret: [s + mark.length, s + mark.length + sel.length] };
    });
  const insert = (str: string) =>
    edit((t, s, e) => {
      const pre = s > 0 && !/\s$/.test(t.slice(0, s)) && /^[@#]/.test(str) ? " " : "";
      const text = t.slice(0, s) + pre + str + t.slice(e);
      const pos = s + pre.length + str.length;
      return { text, caret: [pos, pos] };
    });
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <button type="button" className={btn} onClick={() => wrap("**", "fett")} aria-label="Fett" title="Fett">
        <Bold className="size-4" />
      </button>
      <button type="button" className={btn} onClick={() => wrap("*", "kursiv")} aria-label="Kursiv" title="Kursiv">
        <Italic className="size-4" />
      </button>
      <LinkButton edit={edit} />
      <button type="button" className={btn} onClick={() => insert("@")} aria-label="Person erwähnen" title="Person erwähnen">
        <AtSign className="size-4" />
      </button>
      <button type="button" className={btn} onClick={() => insert("#")} aria-label="Hashtag" title="Hashtag">
        <Hash className="size-4" />
      </button>
      <EmojiPicker onSelect={(e) => insert(e)} triggerClassName="size-8" />
      {onMedia && (
        <button type="button" className={cn(btn, mediaActive && "bg-accent text-foreground")} onClick={onMedia} aria-label="Bilder oder Videos" title="Bilder oder Videos (max. 10)">
          <ImagePlus className="size-4" />
          {mediaCount ? <span className="ml-0.5 text-[10px] font-bold">{mediaCount}</span> : null}
        </button>
      )}
    </div>
  );
}

function LinkButton({ edit }: { edit: Edit }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const apply = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) return;
    edit((t, s, e) => {
      const sel = label.trim() || t.slice(s, e) || u;
      const md = `[${sel.replace(/[[\]]/g, "")}](${u})`;
      const text = t.slice(0, s) + md + t.slice(e);
      return { text, caret: [s + md.length, s + md.length] };
    });
    setOpen(false);
    setUrl("");
    setLabel("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={btn} aria-label="Link einfügen" title="Link einfügen">
        <Link2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Adresse" autoFocus onKeyDown={(e) => e.key === "Enter" && apply()} />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Linktext (optional)" aria-label="Linktext" onKeyDown={(e) => e.key === "Enter" && apply()} />
        <Button size="sm" onClick={apply} disabled={!/^https?:\/\/\S+$/i.test(url.trim())}>
          Einfügen
        </Button>
      </PopoverContent>
    </Popover>
  );
}
