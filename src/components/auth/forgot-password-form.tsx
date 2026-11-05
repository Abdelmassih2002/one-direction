"use client";

import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { forgotPasswordAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, formAction] = useActionState(forgotPasswordAction, idleState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "success" ? (
        <Alert tone="success">{t("auth.reset.sent")}</Alert>
      ) : null}
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

      <Field label={t("auth.email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </Field>

      <SubmitButton type="submit" block pendingLabel={t("common.saving")}>
        {t("auth.reset.submit")}
      </SubmitButton>
    </form>
  );
}
