"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { Flag } from "@/components/shared/flag";
import { cn } from "@/lib/utils";
import type { Row, SelectOption } from "./types";

/** Virtualisierte Listbox (für 250 Länder, 180 Sprachen usw.). */
export function OptionList({
  id,
  rows,
  activeIndex,
  isSelected,
  onPick,
  onHover,
  emptyText,
  multiple,
  maxHeight = 288,
}: {
  id: string;
  rows: Row[];
  activeIndex: number;
  isSelected: (v: string) => boolean;
  onPick: (o: SelectOption) => void;
  onHover: (index: number) => void;
  emptyText: string;
  multiple?: boolean;
  maxHeight?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i]!.kind === "group" ? 30 : rows[i]!.kind === "option" && (rows[i] as { option: SelectOption }).option.description ? 52 : 38),
    overscan: 8,
  });

  const activeRow = rows.findIndex((r) => r.kind === "option" && r.index === activeIndex);
  useEffect(() => {
    if (activeRow >= 0) virtualizer.scrollToIndex(activeRow, { align: "auto" });
  }, [activeRow, virtualizer]);

  if (rows.length === 0) return <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>;

  return (
    <div
      ref={parentRef}
      id={id}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      tabIndex={-1}
      className="overflow-y-auto p-1 outline-none"
      style={{ maxHeight }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index]!;
          const style = { position: "absolute" as const, top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` };
          if (row.kind === "group") {
            return (
              <div key={`g-${row.label}`} role="presentation" style={style} className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground" data-index={vi.index} ref={virtualizer.measureElement}>
                {row.label}
              </div>
            );
          }
          const o = row.option;
          const selected = isSelected(o.value);
          const active = row.index === activeIndex;
          return (
            <div
              key={o.value}
              id={`${id}-opt-${row.index}`}
              role="option"
              aria-selected={selected}
              aria-disabled={o.disabled || undefined}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={style}
              onMouseMove={() => !active && onHover(row.index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !o.disabled && onPick(o)}
              className={cn(
                "flex cursor-default select-none items-center gap-2.5 rounded-sm px-2 py-2 text-sm",
                active && "bg-accent",
                o.disabled && "opacity-50",
              )}
            >
              {o.flag && <Flag code={o.flag} className="size-5" />}
              {o.icon && <span className="flex size-5 items-center justify-center [&_svg]:size-4">{o.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}
              </span>
              {multiple ? (
                <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", selected ? "border-primary bg-primary text-white" : "border-input")}>
                  {selected && <Check className="size-3" />}
                </span>
              ) : (
                selected && <Check className="size-4 text-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
