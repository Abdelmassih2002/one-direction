import type { Metadata } from "next";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/shared/action-form";
import { saveDailyReviewAction } from "@/server/actions/reviews";
import { formatDateKey, todayKey } from "@/lib/time";
import { isValidDateKey } from "@/lib/date-keys";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();
  const params = await searchParams;
  const today = todayKey(profile?.timezone ?? "UTC");
  const date = params.date && isValidDateKey(params.date) ? params.date : today;

  const supabase = await createClient();
  const [reviewResult, historyResult] = await Promise.all([
    supabase
      .from("daily_reviews")
      .select("*")
      .eq("owner_id", user.id)
      .eq("review_date", date)
      .maybeSingle(),
    supabase
      .from("daily_reviews")
      .select("id, review_date, wins, energy_level")
      .eq("owner_id", user.id)
      .order("review_date", { ascending: false })
      .limit(7),
  ]);

  const review = reviewResult.data;
  assertRead([historyResult], "journal");

  const history = historyResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("journal.title")}
        subtitle={t("journal.subtitle")}
        actions={
          <form method="get" className="flex items-end gap-2">
            <Field label={t("journal.date")} htmlFor="date">
              <Input id="date" name="date" type="date" defaultValue={date} max={today} />
            </Field>
            <button
              type="submit"
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm font-medium"
            >
              {t("common.select")}
            </button>
          </form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface p-5">
          <h2 className="mb-1 text-sm font-semibold">
            {formatDateKey(date, locale, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <p className="mb-4 text-xs text-[var(--color-muted)]">{t("journal.privacy-note")}</p>

          <ActionForm
            action={saveDailyReviewAction}
            submitLabel={t("common.save")}
            showSuccess
            fields={{ reviewDate: date }}
          >
            <div className="space-y-3 pb-3">
              <Field label={t("journal.wins")} htmlFor="wins">
                <Textarea id="wins" name="wins" rows={2} defaultValue={review?.wins ?? ""} />
              </Field>
              <Field label={t("journal.blockers")} htmlFor="blockers">
                <Textarea id="blockers" name="blockers" rows={2} defaultValue={review?.blockers ?? ""} />
              </Field>
              <Field label={t("journal.next-step")} htmlFor="nextStep">
                <Textarea
                  id="nextStep"
                  name="nextStep"
                  rows={2}
                  defaultValue={review?.next_step ?? ""}
                />
              </Field>
              <Field label={t("journal.gratitude")} htmlFor="gratitude">
                <Textarea
                  id="gratitude"
                  name="gratitude"
                  rows={2}
                  defaultValue={review?.gratitude ?? ""}
                />
              </Field>
              <Field
                label={t("journal.energy")}
                htmlFor="energyLevel"
                hint={t("journal.energy-hint")}
              >
                <Select
                  id="energyLevel"
                  name="energyLevel"
                  defaultValue={review?.energy_level ? String(review.energy_level) : ""}
                >
                  <option value="">{t("common.optional")}</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {t(`journal.energy.${level}` as MessageKey)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </section>

        <section aria-labelledby="journal-history" className="space-y-2">
          <h2 id="journal-history" className="text-sm font-semibold">
            {t("journal.history")}
          </h2>
          {history.length === 0 ? (
            <EmptyState title={t("journal.history-empty")} />
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="surface p-3">
                  <a
                    href={`/app/journal?date=${entry.review_date}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium">
                      {formatDateKey(entry.review_date, locale, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {entry.energy_level ? (
                      <span className="text-xs text-[var(--color-muted)]">
                        {t("journal.energy")}: {entry.energy_level}/5
                      </span>
                    ) : null}
                  </a>
                  {entry.wins ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                      {entry.wins}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {!review ? (
            <Alert tone="info">
              {t("journal.empty-title")} — {t("journal.empty-body")}
            </Alert>
          ) : null}
        </section>
      </div>
    </div>
  );
}
