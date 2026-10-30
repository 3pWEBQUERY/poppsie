import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export type ErrorCode = "UNAUTHENTICATED" | "PROFILE_INCOMPLETE" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "INVALID" | "CONFLICT";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  PROFILE_INCOMPLETE: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INVALID: 422,
  CONFLICT: 409,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
  get status() {
    return STATUS[this.code];
  }
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; code: ErrorCode; status: number; error: string };

/**
 * Wrapper für Server Actions: einheitliche Fehler, z. B. 403 PROFILE_INCOMPLETE.
 * Das UI zeigt bei PROFILE_INCOMPLETE das Hinweis-Popover.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, code: err.code, status: err.status, error: err.message };
    if (isRedirectError(err)) throw err;
    console.error(err);
    return { ok: false, code: "INVALID", status: 500, error: "Unerwarteter Fehler" };
  }
}

function isRedirectError(err: unknown) {
  return typeof err === "object" && err !== null && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_");
}

/** Route Handler: ApiError → JSON-Antwort mit Status. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return Response.json({ code: err.code, error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ code: "INTERNAL", error: "Unerwarteter Fehler" }, { status: 500 });
}

type Opts = { complete?: boolean; types?: SessionUser["accountType"][]; roles?: SessionUser["role"][] };

/** Für Actions und APIs: wirft ApiError statt umzuleiten. Serverseitige Durchsetzung der Dashboard-Sperre. */
export async function requireUser(opts: Opts = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Bitte melde dich an");
  if (opts.roles && !opts.roles.includes(user.role)) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
  if (opts.types && !opts.types.includes(user.accountType)) throw new ApiError("FORBIDDEN", "Für deinen Kontotyp nicht verfügbar");
  if (opts.complete && !user.profileComplete) throw new ApiError("PROFILE_INCOMPLETE", "Bitte stelle zuerst dein Profil fertig");
  return user;
}

/** Für Seiten: leitet auf Login bzw. Dashboard um. */
export async function requirePageUser(opts: Opts & { next?: string } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/anmelden${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.roles && !opts.roles.includes(user.role)) redirect("/dashboard");
  if (opts.types && !opts.types.includes(user.accountType)) redirect("/dashboard");
  return user;
}

export const isStaff = (u: Pick<SessionUser, "role"> | null | undefined) => u?.role === "admin" || u?.role === "moderator";
