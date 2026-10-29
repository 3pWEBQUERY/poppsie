"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { autoUpdate, flip, FloatingFocusManager, FloatingPortal, offset, size, useDismiss, useFloating, useInteractions, useRole } from "@floating-ui/react";
import { ChevronDown, Search, X } from "lucide-react";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { OptionList } from "./option-list";
import type { BaseSelectProps, Row, SelectOption } from "./types";

type CoreProps = BaseSelectProps & {
  multiple: boolean;
  selected: string[];
  onPick: (o: SelectOption) => void;
  onClear: () => void;
  onRemoveLast?: () => void;
  triggerContent: ReactNode;
  hasValue: boolean;
  sheetTitle?: string;
  /** Zusätzlicher Inhalt unter der Liste (z. B. Sterne-Auswahl). */
  footer?: ReactNode;
};

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Gemeinsamer Kern für Single- und Multi-Select: ARIA Combobox/Listbox, Tastatur
 * (Pfeile, Home/End, Enter, Esc, Tab, Typeahead), Floating-UI-Dropdown auf Desktop,
 * Bottom-Sheet auf Mobile – beides mit identischer Optik.
 */
export function SelectCore(props: CoreProps) {
  const { options, searchable, multiple, selected, onPick, disabled, invalid } = props;
  const id = useId();
  const listId = `${props.id ?? id}-list`;
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o.label).includes(q) || normalize(o.description ?? "").includes(q)) : options;
  }, [options, query]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let lastGroup: string | undefined;
    filtered.forEach((option, index) => {
      if (option.group && option.group !== lastGroup) {
        out.push({ kind: "group", label: option.group });
        lastGroup = option.group;
      }
      out.push({ kind: "option", option, index });
    });
    return out;
  }, [filtered]);

  const { refs, floatingStyles, context } = useFloating({
    open: open && !isMobile,
    onOpenChange: (o) => setOpenState(o),
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, { minWidth: `${rects.reference.width}px`, maxHeight: `${Math.min(availableHeight, 380)}px` });
        },
      }),
    ],
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const setOpenState = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (o) {
        const first = filtered.findIndex((x) => selected.includes(x.value));
        setActive(first >= 0 ? first : filtered.findIndex((x) => !x.disabled));
      } else {
        setQuery("");
        setActive(-1);
      }
    },
    [filtered, selected],
  );

  useEffect(() => {
    if (open && searchable) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, searchable]);

  // Aktive Option nach dem Filtern auf den ersten Treffer setzen.
  useEffect(() => {
    if (open) setActive(filtered.findIndex((x) => !x.disabled));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (dir: 1 | -1 | "first" | "last") => {
    if (filtered.length === 0) return;
    let i = dir === "first" ? -1 : dir === "last" ? filtered.length : active;
    const step = dir === "first" ? 1 : dir === "last" ? -1 : dir;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + step + filtered.length) % filtered.length;
      if (!filtered[i]!.disabled) break;
    }
    setActive(i);
  };

  const pick = (o: SelectOption) => {
    onPick(o);
    if (!multiple) {
      setOpenState(false);
      triggerRef.current?.focus();
    }
  };

  const runTypeahead = (key: string) => {
    const now = Date.now();
    const t = typeahead.current;
    t.buffer = now - t.at > 700 ? key : t.buffer + key;
    t.at = now;
    const q = normalize(t.buffer);
    const start = t.buffer.length === 1 ? active + 1 : Math.max(active, 0);
    const order = [...filtered.slice(start), ...filtered.slice(0, start)];
    const hit = order.find((o) => !o.disabled && normalize(o.label).startsWith(q));
    if (hit) setActive(filtered.indexOf(hit));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpenState(true);
      } else if (e.key.length === 1 && !searchable) {
        setOpenState(true);
        runTypeahead(e.key);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        if (!searchable) {
          e.preventDefault();
          move("first");
        }
        break;
      case "End":
        if (!searchable) {
          e.preventDefault();
          move("last");
        }
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0 && filtered[active] && !filtered[active]!.disabled) pick(filtered[active]!);
        break;
      case " ":
        if (!searchable) {
          e.preventDefault();
          if (active >= 0 && filtered[active]) pick(filtered[active]!);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpenState(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpenState(false);
        break;
      case "Backspace":
        if (multiple && searchable && query === "") props.onRemoveLast?.();
        break;
      default:
        if (e.key.length === 1 && !searchable) runTypeahead(e.key);
    }
  };

  const activeId = open && active >= 0 ? `${listId}-opt-${active}` : undefined;

  const panel = (
    <div className="flex min-h-0 flex-col">
      {searchable && (
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label={props.searchPlaceholder ?? "Suchen"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={props.searchPlaceholder ?? "Suchen …"}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <OptionList
        id={listId}
        rows={rows}
        activeIndex={active}
        isSelected={(v) => selected.includes(v)}
        onPick={pick}
        onHover={setActive}
        emptyText={props.emptyText ?? "Keine Treffer"}
        multiple={multiple}
        maxHeight={isMobile ? 9999 : 300}
      />
      {props.footer}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "relative flex min-h-10 w-full items-center rounded-md border border-input bg-card text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
          invalid && "border-destructive ring-destructive/30",
          disabled && "cursor-not-allowed opacity-50",
          props.className,
        )}
      >
        <button
          type="button"
          ref={(el) => {
            triggerRef.current = el;
            refs.setReference(el);
          }}
          id={props.id}
          role={searchable ? undefined : "combobox"}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={!searchable ? activeId : undefined}
          aria-invalid={invalid || undefined}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          disabled={disabled}
          {...getReferenceProps({ onClick: () => setOpenState(!open), onKeyDown })}
          className="flex min-h-10 w-full min-w-0 flex-1 items-center gap-2 py-1.5 pr-16 pl-3 text-left outline-none disabled:cursor-not-allowed"
        >
          {props.triggerContent}
        </button>
        <span className="pointer-events-none absolute right-3 flex items-center gap-1">
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
        {props.clearable && props.hasValue && !disabled && (
          <button
            type="button"
            aria-label="Auswahl löschen"
            onClick={props.onClear}
            className="absolute right-8 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        )}
        {props.name && selected.map((v) => <input key={v} type="hidden" name={props.name} value={v} />)}
      </div>

      {open && !isMobile && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={searchable ? searchRef : -1} returnFocus={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({ onKeyDown: searchable ? undefined : onKeyDown })}
              className="z-50 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground"
            >
              {panel}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
      {isMobile && (
        <BottomSheet open={open} onOpenChange={(o) => setOpenState(o)}>
          <BottomSheetContent aria-describedby={undefined}>
            <BottomSheetHeader>
              <BottomSheetTitle className="text-base">{props.sheetTitle ?? props.placeholder ?? "Auswählen"}</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" onKeyDown={searchable ? undefined : onKeyDown}>
              {panel}
            </div>
          </BottomSheetContent>
        </BottomSheet>
      )}
    </>
  );
}
