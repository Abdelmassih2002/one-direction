"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { safeNextPath } from "@/lib/utils";
import { resolveAppUrl } from "@/lib/app-url";
import { formString } from "@/lib/validation/common";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { validationFailure, failure } from "./helpers";
import type { ActionState } from "./types";

/**
 * F-07: callbacks use the configured canonical origin, never Host or
 * X-Forwarded-Host, which a client can forge.
 */
function origin(): string | null {
  return resolveAppUrl();
}

function mapAuthError(code: string | undefined, message: string | undefined): ActionState {
  const haystack = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  if (haystack.includes("invalid_credentials") || haystack.includes("invalid login")) {
    return failure("auth.errors.invalid-credentials");
  }
  if (haystack.includes("email_not_confirmed") || haystack.includes("not confirmed")) {
    return failure("auth.errors.email-not-confirmed");
  }
  if (haystack.includes("already registered") || haystack.includes("user_already_exists")) {
    return failure("auth.errors.email-taken");
  }
  return failure("auth.errors.generic");
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formString(formData.get("email")),
    password: formString(formData.get("password")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return mapAuthError(error.code, error.message);

  redirect(safeNextPath(formString(formData.get("next")) || null));
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formString(formData.get("email")),
    password: formString(formData.get("password")),
    displayName: formString(formData.get("displayName")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const base = origin();
  if (!base) return failure("auth.errors.configuration");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${base}/auth/callback?next=/onboarding`,
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) return mapAuthError(error.code, error.message);

  if (data.session) {
    // Email confirmation disabled: profile row is created by the DB trigger.
    await supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("id", data.user!.id);
    redirect("/onboarding");
  }

  redirect(`/auth/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(LOCALE_COOKIE);
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formString(formData.get("email")) });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const base = origin();
  if (!base) return failure("auth.errors.configuration");
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${base}/auth/callback?next=/auth/reset-password`,
  });

  // Always report success: never disclose whether an account exists.
  return { status: "success", messageKey: "auth.reset.sent" };
}

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData.get("password")),
    confirmPassword: formString(formData.get("confirmPassword")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return mapAuthError(error.code, error.message);

  redirect("/app/today");
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
