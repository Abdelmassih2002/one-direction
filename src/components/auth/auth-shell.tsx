import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import type { Locale } from "@/lib/types/models";

export function AuthShell({
  locale,
  title,
  subtitle,
  children,
  footer,
}: {
  locale: Locale;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white"
            >
              1
            </span>
            <span className="text-sm font-semibold tracking-tight">ONE DIRECTION</span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>

        <main id="main" className="w-full">
          <div className="surface p-6 sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
          {footer ? (
            <div className="mt-5 text-center text-sm text-[var(--color-text-secondary)]">
              {footer}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
