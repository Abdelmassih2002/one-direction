"use client";

import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { deleteAccountAction } from "@/server/actions/profile";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteAccountForm() {
  const { t } = useI18n();
  const [state, formAction] = useActionState(deleteAccountAction, idleState);

  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

      <Field label={t("settings.delete-confirm-label")} htmlFor="confirmation">
        <Input
          id="confirmation"
          name="confirmation"
          autoComplete="off"
          required
          pattern="DELETE"
          placeholder="DELETE"
          dir="ltr"
        />
      </Field>

      <SubmitButton type="submit" variant="danger" pendingLabel={t("settings.deleting")}>
        {t("settings.delete-button")}
      </SubmitButton>
    </form>
  );
}
