"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { signUpAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { MessageKey } from "@/lib/i18n";

export function SignUpForm() {
  const { t } = useI18n();
  const [state, formAction] = useActionState(signUpAction, idleState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(state.fieldErrors[name] as MessageKey) : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

      <Field
        label={t("auth.display-name")}
        htmlFor="displayName"
        error={fieldError("displayName")}
      >
        <Input id="displayName" name="displayName" autoComplete="name" required />
      </Field>

      <Field label={t("auth.email")} htmlFor="email" error={fieldError("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor="password"
        error={fieldError("password")}
        hint={t("auth.errors.password-min")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <SubmitButton type="submit" block pendingLabel={t("auth.creating-account")}>
        {t("auth.sign-up.submit")}
      </SubmitButton>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        {t("auth.has-account")}{" "}
        <Link href="/auth/sign-in" className="text-[var(--color-primary)] hover:underline">
          {t("auth.sign-in.submit")}
        </Link>
      </p>
      <p className="text-center text-xs text-[var(--color-muted)]">{t("journal.privacy-note")}</p>
    </form>
  );
}
