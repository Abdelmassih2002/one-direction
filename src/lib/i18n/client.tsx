"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { translate, type MessageKey, type TranslateValues } from "@/lib/i18n";
import { direction } from "@/lib/i18n";
import type { Locale } from "@/lib/types/models";

interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: MessageKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: direction(locale),
      t: (key, values) => translate(locale, key, values),
    }),
    [locale]
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
