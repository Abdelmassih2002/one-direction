import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { email } = await searchParams;

  return (
    <AuthShell
      locale={locale}
      title={t("auth.check-email.title")}
      footer={
        <Link href="/auth/sign-in" className="text-[var(--color-primary)] hover:underline">
          {t("auth.reset.back")}
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--color-primary-soft)]">
          <MailCheck className="size-6 text-[var(--color-primary)]" aria-hidden="true" />
        </span>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("auth.check-email.body", { email: email ?? "" })}
        </p>
      </div>
    </AuthShell>
  );
}
