import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { todayKey, weekStartKeyForProfile } from "@/lib/onboarding";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Set up" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();

  if (profile?.onboarding_completed_at) {
    redirect("/app/today");
  }

  const supabase = await createClient();
  const areasResult = await supabase
    .from("life_areas")
    .select("id, name")
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  assertRead([areasResult], "onboarding");
  const areas = areasResult.data ?? [];

  const timezone = profile?.timezone ?? "UTC";

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            ONE DIRECTION
          </p>
          <h1 className="text-2xl font-semibold">{t("onboarding.title")}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("onboarding.subtitle")}</p>
        </header>

        <OnboardingWizard
          locale={locale}
          timezone={timezone}
          weekStart={profile?.week_start ?? "monday"}
          displayName={profile?.display_name ?? user.email?.split("@")[0] ?? ""}
          areas={(areas ?? []).map((area) => ({ id: area.id, name: area.name }))}
          startDate={todayKey(timezone)}
          weekStartKey={weekStartKeyForProfile(todayKey(timezone), profile?.week_start ?? "monday")}
        />
      </div>
    </div>
  );
}
