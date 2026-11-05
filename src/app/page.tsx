import Link from "next/link";
import { ArrowRight, Compass, Layers, MoonStar, ShieldCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Badge } from "@/components/ui/badge";

export default async function MarketingHome() {
  const { t, locale } = await getI18n();
  const user = await getSessionUser();

  const pillars = [
    { key: "focus", icon: Compass },
    { key: "hold", icon: Layers },
    { key: "rest", icon: MoonStar },
  ] as const;

  const steps = ["step1", "step2", "step3", "step4"] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white"
            >
              1
            </span>
            <span className="text-sm font-semibold tracking-tight">{t("app.name")}</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label={t("marketing.nav.product")}>
            <LanguageSwitcher locale={locale} />
            {user ? (
              <Button asChild size="sm">
                <Link href="/app/today">{t("nav.today")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/sign-in">{t("marketing.hero.secondary")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/sign-up">{t("marketing.hero.cta")}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-3xl space-y-6">
            <Badge tone="primary">{t("marketing.hero.badge")}</Badge>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {t("marketing.hero.title")}
            </h1>
            <p className="max-w-2xl text-base text-[var(--color-text-secondary)] sm:text-lg">
              {t("marketing.hero.subtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={user ? "/app/today" : "/auth/sign-up"}>
                  {user ? t("nav.today") : t("marketing.hero.cta")}
                  <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
                </Link>
              </Button>
              {!user ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href="/auth/sign-in">{t("marketing.hero.secondary")}</Link>
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-[var(--color-muted)]">{t("marketing.hero.note")}</p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {pillars.map(({ key, icon: Icon }) => (
              <article key={key} className="surface p-5">
                <Icon className="mb-3 size-5 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="text-sm font-semibold">
                  {t(`marketing.pillar.${key}.title`)}
                </h2>
                <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
                  {t(`marketing.pillar.${key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-surface)]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold">{t("marketing.how.title")}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("marketing.how.subtitle")}
              </p>
            </div>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
                  <span className="text-xs font-semibold text-[var(--color-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold">
                    {t(`marketing.how.${step}.title`)}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {t(`marketing.how.${step}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-6 sm:flex-row sm:items-start sm:p-8">
            <ShieldCheck className="size-6 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">{t("marketing.privacy.title")}</h2>
              <p className="max-w-3xl text-sm text-[var(--color-text-secondary)]">
                {t("marketing.privacy.body")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border-soft)] py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{t("marketing.footer.rights")}</span>
          <span>{t("marketing.footer.tagline")}</span>
        </div>
      </footer>
    </div>
  );
}
