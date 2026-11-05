import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { t, locale } = await getI18n();
  const params = await searchParams;

  return (
    <AuthShell
      locale={locale}
      title={t("auth.sign-in.title")}
      subtitle={t("auth.sign-in.subtitle")}
      footer={
        <>
          {t("auth.no-account")}{" "}
          <Link href="/auth/sign-up" className="text-[var(--color-primary)] hover:underline">
            {t("auth.sign-up.submit")}
          </Link>
        </>
      }
    >
      <SignInForm next={params.next} />
    </AuthShell>
  );
}
