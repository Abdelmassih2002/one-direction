import type { MessageKey } from "@/lib/i18n";

export interface ActionState {
  status: "idle" | "success" | "error";
  /** Translation key, never user data. */
  messageKey?: MessageKey;
  fieldErrors?: Record<string, MessageKey>;
  /** Optional identifier of the record created by the action. */
  id?: string;
}

export const idleState: ActionState = { status: "idle" };
export const successState: ActionState = { status: "success" };
