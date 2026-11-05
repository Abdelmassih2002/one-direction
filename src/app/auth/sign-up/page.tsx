import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  const { t, locale } = await getI18n();

  return (
    <AuthShell
      locale={locale}
      title={t("auth.sign-up.title")}
      subtitle={t("auth.sign-up.subtitle")}
    >
      <SignUpForm />
    </AuthShell>
  );
}
