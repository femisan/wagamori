import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, getDict, isLocale, type Locale } from "./i18n";

/** Read the active locale from the cookie (server components / route handlers). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : defaultLocale;
}

/** Convenience: locale + its dictionary together. */
export async function getServerT() {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}
