import type { ReactNode } from "react";

export type SelectOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
  icon?: ReactNode;
  /** ISO-3166-Code: zeigt eine runde, gefüllte Flagge. */
  flag?: string;
  disabled?: boolean;
};

export type BaseSelectProps = {
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  className?: string;
  emptyText?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/** Zeile in der (virtualisierten) Liste: Gruppenkopf oder Option. */
export type Row = { kind: "group"; label: string } | { kind: "option"; option: SelectOption; index: number };
