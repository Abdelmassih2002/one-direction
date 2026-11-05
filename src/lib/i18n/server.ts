import "server-only";

import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  direction,
  isLocale,
  translate,
  type MessageKey,
  type TranslateValues,
} from "@/lib/i18n";
import { getCurrentProfile } from "@/lib/auth/session";
import type { Locale } from "@/lib/types/models";

/** Cookie keeps the document language stable even before the profile loads. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const profile = await getCurrentProfile();
  if (profile && isLocale(profile.locale)) return profile.locale;

  return DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  return {
    locale,
    dir: direction(locale),
    t: (key: MessageKey, values?: TranslateValues) => translate(locale, key, values),
  };
}
