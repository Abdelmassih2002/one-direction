import "server-only";

import type { z } from "zod";
import type { MessageKey } from "@/lib/i18n";
import { mapDbError } from "@/lib/utils";
import type { ActionState } from "./types";

export function fieldErrorsFrom(error: z.ZodError): Record<string, MessageKey> {
  const errors: Record<string, MessageKey> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) {
      errors[key] = "errors.invalid-input";
    }
  }
  return errors;
}

export function validationFailure(error: z.ZodError): ActionState {
  return {
    status: "error",
    messageKey: "errors.invalid-input",
    fieldErrors: fieldErrorsFrom(error),
  };
}

export function failure(messageKey: MessageKey): ActionState {
  return { status: "error", messageKey };
}

export function dbFailure(message: string | undefined): ActionState {
  return { status: "error", messageKey: mapDbError(message) as MessageKey };
}

export function success(id?: string): ActionState {
  return { status: "success", id };
}

export function readBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function readList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}
