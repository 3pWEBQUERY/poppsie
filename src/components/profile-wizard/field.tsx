"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Beschriftetes Feld mit Hinweis und Inline-Fehler. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && (
          <span className="text-primary" aria-label="Pflichtfeld">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  maxLength,
  placeholder,
  disabled,
  type = "text",
  className,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <Input
        id={id}
        type={type}
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
       
      />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  min,
  max,
  step,
  suffix,
  className,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          className={cn(suffix && "pr-12")}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  maxLength,
  minLength,
  rows = 6,
  placeholder,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  maxLength: number;
  minLength?: number;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  const len = value?.length ?? 0;
  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      required={required}
      hint={
        <span className="flex justify-between gap-2">
          <span>{hint}</span>
          <span className={cn(minLength && len < minLength && "text-warning")}>
            {len}/{maxLength}
            {minLength ? ` · mind. ${minLength}` : ""}
          </span>
        </span>
      }
    >
      <Textarea
        id={id}
        rows={rows}
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      />
    </Field>
  );
}

/** Abschnittstitel innerhalb eines Schritts. */
export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}
