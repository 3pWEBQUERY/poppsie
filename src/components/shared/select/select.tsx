"use client";

import { X } from "lucide-react";
import { Flag } from "@/components/shared/flag";
import { StarRating } from "@/components/shared/star-rating";
import { SelectCore } from "./select-core";
import type { BaseSelectProps, SelectOption } from "./types";

export type { SelectOption } from "./types";

function OptionLabel({ option }: { option: SelectOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.flag && <Flag code={option.flag} className="size-5" />}
      {option.icon && <span className="flex [&_svg]:size-4">{option.icon}</span>}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

/** Einzelauswahl. Mit `name` wird der Wert zusätzlich als verstecktes Formularfeld übermittelt. */
export function Select({
  value,
  onChange,
  ...props
}: BaseSelectProps & { value: string | null | undefined; onChange: (value: string | null) => void; sheetTitle?: string }) {
  const current = props.options.find((o) => o.value === value);
  return (
    <SelectCore
      {...props}
      multiple={false}
      selected={value ? [value] : []}
      hasValue={Boolean(value)}
      onPick={(o) => onChange(o.value)}
      onClear={() => onChange(null)}
      triggerContent={current ? <OptionLabel option={current} /> : <span className="truncate text-muted-foreground">{props.placeholder ?? "Bitte wählen"}</span>}
    />
  );
}

/** Mehrfachauswahl mit Chips. */
export function MultiSelect({
  value,
  onChange,
  max,
  ...props
}: BaseSelectProps & { value: string[]; onChange: (value: string[]) => void; max?: number; sheetTitle?: string }) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!max || value.length < max) onChange([...value, v]);
  };
  const chosen = value.map((v) => props.options.find((o) => o.value === v)).filter(Boolean) as SelectOption[];
  return (
    <SelectCore
      {...props}
      multiple
      selected={value}
      hasValue={value.length > 0}
      onPick={(o) => toggle(o.value)}
      onClear={() => onChange([])}
      onRemoveLast={() => onChange(value.slice(0, -1))}
      triggerContent={
        chosen.length === 0 ? (
          <span className="truncate text-muted-foreground">{props.placeholder ?? "Bitte wählen"}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {chosen.map((o) => (
              <Chip key={o.value} option={o} onRemove={() => toggle(o.value)} disabled={props.disabled} />
            ))}
          </span>
        )
      }
    />
  );
}

function Chip({ option, onRemove, disabled, children }: { option: SelectOption; onRemove: () => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2 text-xs">
      {option.flag && <Flag code={option.flag} className="size-3.5" />}
      <span className="truncate">{option.label}</span>
      {children}
      {!disabled && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`${option.label} entfernen`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="size-3" />
        </span>
      )}
    </span>
  );
}

export type ExtraValue = { value: string; level: number };

/**
 * Mehrfachauswahl mit Zusatzwert pro Option (z. B. Sprachen mit Niveau 1–5 Sternen).
 * Die Sterne werden unter dem Feld je ausgewählter Option bedient.
 */
export function MultiSelectWithLevel({
  value,
  onChange,
  levelLabel = "Niveau",
  ...props
}: BaseSelectProps & { value: ExtraValue[]; onChange: (v: ExtraValue[]) => void; levelLabel?: string; sheetTitle?: string }) {
  const codes = value.map((v) => v.value);
  return (
    <div className="flex flex-col gap-2">
      <MultiSelect
        {...props}
        value={codes}
        onChange={(next) => onChange(next.map((c) => value.find((v) => v.value === c) ?? { value: c, level: 3 }))}
      />
      {value.length > 0 && (
        <ul className="flex flex-col divide-y rounded-md border">
          {value.map((v) => {
            const o = props.options.find((x) => x.value === v.value);
            return (
              <li key={v.value} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {o?.flag && <Flag code={o.flag} className="size-4" />}
                  {o?.label ?? v.value}
                </span>
                <StarRating
                  value={v.level}
                  label={`${levelLabel} ${o?.label ?? v.value}`}
                  onChange={(level) => onChange(value.map((x) => (x.value === v.value ? { ...x, level } : x)))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
