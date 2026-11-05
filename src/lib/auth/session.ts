import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/models";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Data Access Layer: the single place that reads the session.
 * The returned user id is the only trusted ownership source.
 * Returns null when Supabase is not configured so public pages can still render.
 */
export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
});

/** Page-level guard: redirects to sign-in when there is no session. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

/** Server Action guard: throws instead of redirecting. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user.id;
}
