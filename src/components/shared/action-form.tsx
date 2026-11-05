"use client";

import { useActionState, useContext, createContext, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";
import { idleState, type ActionState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonProps } from "@/components/ui/button";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

interface ActionFormContextValue {
  state: ActionState;
}

const ActionFormContext = createContext<ActionFormContextValue>({ state: idleState });

/** Hook to access the current ActionForm state from within a form's children. Returns idleState when not inside an ActionForm. */
export function useActionFormState(): ActionState {
  return useContext(ActionFormContext).state;
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  variant = "primary",
  size = "md",
  block = false,
  hideSubmit = false,
  showSuccess = false,
  fields,
}: {
  action: ServerAction;
  children?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  block?: boolean;
  hideSubmit?: boolean;
  showSuccess?: boolean;
  fields?: Record<string, string | number | boolean | undefined>;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const { t } = useI18n();

  return (
    <ActionFormContext.Provider value={{ state }}>
      <form action={formAction} className={className}>
        {state.status === "error" && state.messageKey ? (
          <Alert tone="error" className="mb-3">
            {t(state.messageKey)}
          </Alert>
        ) : null}
        {state.status === "success" && showSuccess ? (
          <Alert tone="success" className="mb-3">
            {t("common.saved")}
          </Alert>
        ) : null}

        {fields
          ? Object.entries(fields).map(([name, value]) =>
              value === undefined ? null : (
                <input
                  key={name}
                  type="hidden"
                  name={name}
                  value={typeof value === "boolean" ? String(value) : value}
                />
              )
            )
          : null}

        {children}

        {hideSubmit ? null : (
          <SubmitButton
            type="submit"
            variant={variant}
            size={size}
            block={block}
            pendingLabel={pendingLabel ?? t("common.saving")}
          >
            {submitLabel ?? t("common.save")}
          </SubmitButton>
        )}
      </form>
    </ActionFormContext.Provider>
  );
}

/** One-click mutation with hidden fields, rendered as a small button. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "ghost",
  size = "sm",
  ariaLabel,
  className,
}: {
  action: ServerAction;
  fields?: Record<string, string | number | boolean | undefined>;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  ariaLabel?: string;
  className?: string;
}) {
  const [, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className={className}>
      {fields
        ? Object.entries(fields).map(([name, value]) =>
            value === undefined ? null : (
              <input
                key={name}
                type="hidden"
                name={name}
                value={typeof value === "boolean" ? String(value) : value}
              />
            )
          )
        : null}
      <SubmitButton type="submit" variant={variant} size={size} aria-label={ariaLabel}>
        {children}
      </SubmitButton>
    </form>
  );
}
