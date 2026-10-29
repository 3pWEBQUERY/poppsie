"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadProfileDraft, saveProfileStep } from "@/lib/profiles/actions";
import { schemaFor, toFieldErrors, type FieldErrors } from "@/lib/profiles/schemas";
import type { StepKey } from "@/lib/profiles/steps";
import type { MediaValues, ProfileDraft, ProfileStatus, StepValues } from "@/lib/profiles/types";

const AUTOSAVE_MS = 1200;

/** Daten, die an den Server gehen (Medien werden auf IDs reduziert). */
export function payloadFor(step: StepKey, v: StepValues | undefined): unknown {
  if (step !== "media") return v ?? {};
  const m = (v ?? {}) as unknown as MediaValues;
  return {
    avatarId: m.avatar?.id ?? null,
    coverId: m.cover?.id ?? null,
    gallery: (m.gallery ?? []).map((g) => ({ id: g.id, blur: Boolean(g.blurForGuests) })),
    blurForGuests: m.blurForGuests,
  };
}

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Zustand für Profil-Wizard und Profil-Editor: Werte je Schritt, Inline-Fehler (zod, Client und Server),
 * Autosave als Entwurf (entprellt) und explizites Speichern beim Navigieren.
 */
export function useProfileEditor(initial: ProfileDraft | null, opts: { onSaved?: (s: ProfileStatus) => void } = {}) {
  const [draft, setDraft] = useState<ProfileDraft | null>(initial);
  const [values, setValues] = useState<Partial<Record<StepKey, StepValues>>>(initial?.values ?? {});
  const [errors, setErrors] = useState<Partial<Record<StepKey, FieldErrors>>>({});
  const [status, setStatus] = useState<ProfileStatus | null>(initial?.status ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const valuesRef = useRef(values);
  const statusRef = useRef(status);
  const draftRef = useRef(draft);
  const dirty = useRef(new Set<StepKey>());
  const timers = useRef(new Map<StepKey, ReturnType<typeof setTimeout>>());
  const onSavedRef = useRef(opts.onSaved);
  useEffect(() => {
    onSavedRef.current = opts.onSaved;
  });

  useEffect(() => {
    if (initial) return;
    let alive = true;
    loadProfileDraft().then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      draftRef.current = res.data;
      valuesRef.current = res.data.values;
      setDraft(res.data);
      setValues(res.data.values);
      statusRef.current = res.data.status;
      setStatus(res.data.status);
    });
    return () => {
      alive = false;
    };
  }, [initial]);

  const validate = useCallback((step: StepKey, v: StepValues | undefined): FieldErrors => {
    const d = draftRef.current;
    if (!d) return {};
    const schema = schemaFor(d.accountType, step, d.clubFields);
    if (!schema) return {};
    const r = schema.safeParse(payloadFor(step, v));
    return r.success ? {} : toFieldErrors(r.error);
  }, []);

  /** Speichert einen Schritt. explicit = beim Navigieren (zeigt Fehler, meldet onSaved). */
  const persist = useCallback(
    async (step: StepKey, explicit: boolean): Promise<boolean> => {
      const t = timers.current.get(step);
      if (t) clearTimeout(t);
      timers.current.delete(step);
      const v = valuesRef.current[step];
      const errs = validate(step, v);
      if (Object.keys(errs).length) {
        if (explicit) setErrors((e) => ({ ...e, [step]: errs }));
        return false;
      }
      if (!dirty.current.has(step)) {
        setErrors((e) => ({ ...e, [step]: {} }));
        return true;
      }
      dirty.current.delete(step);
      setSaveState("saving");
      const res = await saveProfileStep(step, payloadFor(step, v));
      if (!res.ok) {
        dirty.current.add(step);
        setSaveState("error");
        toast.error(res.error);
        return false;
      }
      if (!res.data.saved) {
        dirty.current.add(step);
        setSaveState("error");
        setErrors((e) => ({ ...e, [step]: res.data.errors }));
        return false;
      }
      setErrors((e) => ({ ...e, [step]: {} }));
      setSaveState("saved");
      if (res.data.status) {
        statusRef.current = res.data.status;
        setStatus(res.data.status);
        if (explicit) onSavedRef.current?.(res.data.status);
      }
      return true;
    },
    [validate],
  );

  const update = useCallback(
    (step: StepKey, v: StepValues) => {
      valuesRef.current = { ...valuesRef.current, [step]: v };
      setValues(valuesRef.current);
      dirty.current.add(step);
      setErrors((e) => (e[step] && Object.keys(e[step]!).length ? { ...e, [step]: validate(step, v) } : e));
      const t = timers.current.get(step);
      if (t) clearTimeout(t);
      timers.current.set(
        step,
        setTimeout(() => void persist(step, false), AUTOSAVE_MS),
      );
    },
    [persist, validate],
  );

  /** Alle offenen Entwürfe speichern (z. B. bei "Später erledigen"). */
  const flush = useCallback(async () => {
    const steps = [...dirty.current];
    await Promise.all(steps.map((s) => persist(s, false)));
  }, [persist]);

  useEffect(() => {
    const map = timers.current;
    const pending = dirty.current;
    return () => {
      // Beim Schliessen ausstehende Entwürfe noch speichern
      for (const t of map.values()) clearTimeout(t);
      for (const step of pending) {
        const v = valuesRef.current[step];
        const d = draftRef.current;
        const schema = d ? schemaFor(d.accountType, step, d.clubFields) : null;
        if (schema?.safeParse(payloadFor(step, v)).success) void saveProfileStep(step, payloadFor(step, v));
      }
    };
  }, []);

  const currentStatus = useCallback(() => statusRef.current, []);

  return { draft, values, errors, status, saveState, loadError, update, persist, flush, currentStatus };
}
