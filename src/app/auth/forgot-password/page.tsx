import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { t, locale } = await getI18n();

  return (
    <AuthShell
      locale={locale}
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      footer={
        <Link href="/auth/sign-in" className="text-[var(--color-primary)] hover:underline">
          {t("auth.reset.back")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
