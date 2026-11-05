"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { quickCaptureAction } from "@/server/actions/tasks";
import { idleState } from "@/server/actions/types";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export function QuickCapture({ placeholder }: { placeholder?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(quickCaptureAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status, state.id]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      {state.status === "error" && state.messageKey ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <label htmlFor="quick-capture-title" className="sr-only">
          {t("tasks.quick-capture")}
        </label>
        <Input
          id="quick-capture-title"
          name="title"
          required
          maxLength={300}
          placeholder={placeholder ?? t("tasks.quick-placeholder")}
        />
        <Button type="submit" size="md" disabled={pending} aria-label={t("tasks.quick-capture")}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
