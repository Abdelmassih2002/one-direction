import { en, type MessageKey } from "./messages/en";
import { ar } from "./messages/ar";
import type { Locale } from "@/lib/types/models";

export const LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "od-locale";

export const messages: Record<Locale, Record<MessageKey, string>> = { en, ar };

export type TranslateValues = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, values?: TranslateValues): string {
  const template = messages[locale]?.[key] ?? en[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ar";
}

export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar" : "en-GB";
}

export type { MessageKey };
