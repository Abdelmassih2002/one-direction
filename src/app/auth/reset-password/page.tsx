import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const { t, locale } = await getI18n();
  const user = await getSessionUser();

  return (
    <AuthShell
      locale={locale}
      title={t("auth.reset.password-title")}
      footer={
        <Link href="/auth/sign-in" className="text-[var(--color-primary)] hover:underline">
          {t("auth.reset.back")}
        </Link>
      }
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert tone="warning">{t("errors.unauthorized")}</Alert>
      )}
    </AuthShell>
  );
}
