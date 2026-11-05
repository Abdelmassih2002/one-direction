"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { formString } from "@/lib/validation/common";

/** Public language switch, persisted in a cookie and (when signed in) the profile. */
export async function switchLocaleAction(formData: FormData): Promise<void> {
  const locale = formString(formData.get("locale"));
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  const user = await getSessionUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }

  revalidatePath("/", "layout");
}
