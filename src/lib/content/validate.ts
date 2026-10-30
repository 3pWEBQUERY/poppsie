import "server-only";
import type { z } from "zod";
import { ApiError } from "@/lib/auth/guards";

/** Zod-Prüfung mit verständlicher Fehlermeldung (erste Meldung als 422 INVALID). */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (res.success) return res.data;
  const issue = res.error.issues[0];
  const custom = issue?.message && !/^(Invalid|Too |Expected|Required)/i.test(issue.message) ? issue.message : null;
  throw new ApiError("INVALID", custom ?? "Bitte prüfe deine Eingaben");
}
