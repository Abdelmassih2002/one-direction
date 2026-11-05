import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { signOutAction } from "@/server/actions/auth";
import { AppNav } from "@/components/layout/app-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();

  if (profile && !profile.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const displayName =
    profile?.display_name ?? (user.email ? user.email.split("@")[0] : t("nav.today"));

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-5 lg:flex">
          <Link href="/app/today" className="mb-6 flex items-center gap-2 px-2">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white"
            >
              1
            </span>
            <span className="text-sm font-semibold tracking-tight">ONE DIRECTION</span>
          </Link>

          <div className="flex-1 overflow-y-auto">
            <AppNav variant="sidebar" />
          </div>

          <div className="mt-4 space-y-3 border-t border-[var(--color-border-soft)] pt-4">
            <div className="px-2">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
            </div>
            <div className="flex items-center justify-between gap-2 px-2">
              <LanguageSwitcher locale={locale} />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-muted-soft)]"
                >
                  <LogOut className="size-3.5 flip-rtl" aria-hidden="true" />
                  {t("auth.sign-out")}
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--background)]/95 px-4 pb-2 pt-3 backdrop-blur lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <Link href="/app/today" className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-7 place-items-center rounded-md bg-[var(--color-primary)] text-xs font-bold text-white"
                >
                  1
                </span>
                <span className="text-sm font-semibold">ONE DIRECTION</span>
              </Link>
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher locale={locale} />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    aria-label={t("auth.sign-out")}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                  >
                    <LogOut className="size-3.5 flip-rtl" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>
            <AppNav variant="mobile" />
          </header>

          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
