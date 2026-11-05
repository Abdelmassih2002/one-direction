"use client";

import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { updatePasswordAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { MessageKey } from "@/lib/i18n";

export function ResetPasswordForm() {
  const { t } = useI18n();
  const [state, formAction] = useActionState(updatePasswordAction, idleState);
  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(state.fieldErrors[name] as MessageKey) : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

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
          minLength={8}
          required
        />
      </Field>

      <Field
        label={t("auth.confirm-password")}
        htmlFor="confirmPassword"
        error={fieldError("confirmPassword")}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton type="submit" block pendingLabel={t("common.saving")}>
        {t("auth.reset.password-submit")}
      </SubmitButton>
    </form>
  );
}
