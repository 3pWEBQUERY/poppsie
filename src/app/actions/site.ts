"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function confirmAge() {
  (await cookies()).set("pp_age", "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
