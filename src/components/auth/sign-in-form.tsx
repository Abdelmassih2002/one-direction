"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { signInAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { MessageKey } from "@/lib/i18n";

export function SignInForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(signInAction, idleState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

      <Field label={t("auth.email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor="password"
        error={state.fieldErrors?.password ? t(state.fieldErrors.password as MessageKey) : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <SubmitButton type="submit" block pendingLabel={t("auth.signing-in")}>
        {t("auth.sign-in.submit")}
      </SubmitButton>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/auth/forgot-password"
          className="text-[var(--color-primary)] hover:underline"
        >
          {t("auth.forgot-password")}
        </Link>
        <Link href="/auth/sign-up" className="text-[var(--color-text-secondary)] hover:underline">
          {t("auth.sign-up.submit")}
        </Link>
      </div>
    </form>
  );
}
