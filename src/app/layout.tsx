import type { Metadata } from "next";
import { direction } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ONE DIRECTION — Personal life operating system",
    template: "%s · ONE DIRECTION",
  },
  description:
    "Hold every goal you care about, focus on one direction at a time, and turn it into the next concrete step. Arabic and English.",
  applicationName: "ONE DIRECTION",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={direction(locale)}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
