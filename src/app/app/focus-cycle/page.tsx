import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Plus } from "lucide-react";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/shared/action-form";
import { createCycleAction, closeCycleAction, updateCycleGoalsAction } from "@/server/actions/cycles";
import { todayKey } from "@/lib/time";
import { formatDateKey } from "@/lib/time";
import { CYCLE_DEFAULT_WEEKS } from "@/lib/domain/cycle";
import type { MessageKey } from "@/lib/i18n";
import type { Goal } from "@/lib/types/models";

export const metadata: Metadata = { title: "Focus Cycle" };

function GoalChoices({
  goals,
  cycleGoals,
  mode,
  t,
}: {
  goals: Goal[];
  cycleGoals: { goal_id: string; role: string }[];
  mode: "create" | "edit";
  t: (key: MessageKey) => string;
}) {
  const roleOf = (goalId: string) => cycleGoals.find((row) => row.goal_id === goalId)?.role;
  const primaryId = cycleGoals.find((row) => row.role === "primary")?.goal_id;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("cycle.primary")}</legend>
        <div className="space-y-1.5">
          {goals.map((goal) => (
            <label
              key={goal.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="primaryGoalId"
                value={goal.id}
                required
                defaultChecked={primaryId === goal.id}
              />
              <span className="truncate">{goal.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("cycle.secondary")}</legend>
        <div className="space-y-1.5">
          {goals.map((goal) => (
            <label
              key={goal.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="secondaryGoalIds"
                value={goal.id}
                defaultChecked={mode === "edit" && roleOf(goal.id) === "secondary"}
              />
              <span className="truncate">{goal.title}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t("cycle.secondary-hint")}</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("cycle.maintenance")}</legend>
        <div className="space-y-1.5">
          {goals.map((goal) => (
            <label
              key={goal.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="maintenanceGoalIds"
                value={goal.id}
                defaultChecked={mode === "edit" && roleOf(goal.id) === "maintenance"}
              />
              <span className="truncate">{goal.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-amber-50 p-2.5 text-xs text-[var(--color-warning)]">
        <input type="checkbox" name="secondaryOverride" value="true" className="mt-0.5" />
        <span>{t("cycle.override-warning")}</span>
      </label>
    </div>
  );
}

export default async function FocusCyclePage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();

  const supabase = await createClient();
  const [goalsResult, cyclesResult] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("focus_cycles")
      .select("*")
      .eq("owner_id", user.id)
      .order("start_date", { ascending: false }),
  ]);

  const goals = (goalsResult.data ?? []).filter(
    (goal) => goal.status !== "completed" && goal.status !== "archived"
  );
  assertRead([goalsResult, cyclesResult], "focus cycle");

  const cycles = cyclesResult.data ?? [];
  const activeCycle = cycles.find((cycle) => cycle.active) ?? null;
  const pastCycles = cycles.filter((cycle) => !cycle.active);

  const cycleGoals = activeCycle
    ? (
        await supabase
          .from("focus_cycle_goals")
          .select("goal_id, role")
          .eq("owner_id", user.id)
          .eq("cycle_id", activeCycle.id)
      ).data ?? []
    : [];

  const goalById = (id: string) => goals.find((goal) => goal.id === id);
  const primary = cycleGoals.find((row) => row.role === "primary");
  const secondaries = cycleGoals.filter((row) => row.role === "secondary");
  const maintenance = cycleGoals.filter((row) => row.role === "maintenance");

  return (
    <div className="space-y-6">
      <PageHeader title={t("cycle.title")} subtitle={t("cycle.subtitle")} />

      {goals.length === 0 ? (
        <Alert tone="info">
          {t("cycle.no-goals")}{" "}
          <Link href="/app/goals" className="font-medium underline">
            {t("goals.create")}
          </Link>
        </Alert>
      ) : null}

      {activeCycle ? (
        <Card className="border-[var(--color-primary)]/30">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>{activeCycle.title || t("cycle.status.active")}</CardTitle>
              <p className="text-xs text-[var(--color-muted)]">
                {formatDateKey(activeCycle.start_date, locale, { dateStyle: "medium" })} –{" "}
                {formatDateKey(activeCycle.end_date, locale, { dateStyle: "medium" })}
              </p>
            </div>
            <Badge tone="primary">{t("cycle.weeks", { count: activeCycle.duration_weeks })}</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[var(--radius)] bg-[var(--color-primary-soft)]/60 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-primary)]">
                <Compass className="size-3.5" aria-hidden="true" />
                {t("cycle.primary")}
              </p>
              {primary ? (
                <Link
                  href={`/app/goals/${primary.goal_id}`}
                  className="mt-1 block text-lg font-semibold hover:underline"
                >
                  {goalById(primary.goal_id)?.title ?? t("cycle.no-active-goal")}
                </Link>
              ) : (
                <p className="mt-1 text-sm">{t("cycle.no-active-goal")}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {t("cycle.secondary")}
                </p>
                {secondaries.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">{t("common.none")}</p>
                ) : (
                  <ul className="space-y-1">
                    {secondaries.map((row) => (
                      <li key={row.goal_id} className="text-sm">
                        {goalById(row.goal_id)?.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {t("cycle.maintenance")}
                </p>
                {maintenance.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">{t("common.none")}</p>
                ) : (
                  <ul className="space-y-1">
                    {maintenance.map((row) => (
                      <li key={row.goal_id} className="text-sm">
                        {goalById(row.goal_id)?.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <details className="rounded-[var(--radius)] border border-[var(--color-border-soft)] p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {t("cycle.edit-goals")}
                </summary>
                <div className="pt-3">
                  <ActionForm
                    action={updateCycleGoalsAction}
                    submitLabel={t("common.save")}
                    fields={{ cycleId: activeCycle.id }}
                    size="sm"
                  >
                    <GoalChoices goals={goals} cycleGoals={cycleGoals} mode="edit" t={t} />
                  </ActionForm>
                </div>
              </details>

              <details className="rounded-[var(--radius)] border border-[var(--color-border-soft)] p-4">
                <summary className="cursor-pointer text-sm font-medium">{t("cycle.close")}</summary>
                <div className="space-y-3 pt-3">
                  <p className="text-xs text-[var(--color-muted)]">{t("cycle.close-body")}</p>
                  <ActionForm
                    action={closeCycleAction}
                    submitLabel={t("cycle.close")}
                    variant="secondary"
                    fields={{ cycleId: activeCycle.id }}
                    size="sm"
                  >
                    <div className="space-y-2 pb-2">
                      <Field label={t("cycle.outcome")} htmlFor="outcome">
                        <Select id="outcome" name="outcome" required defaultValue="">
                          <option value="" disabled>
                            {t("common.select")}
                          </option>
                          <option value="achieved">{t("cycle.outcome.achieved")}</option>
                          <option value="progress">{t("cycle.outcome.progress")}</option>
                          <option value="direction_change">
                            {t("cycle.outcome.direction_change")}
                          </option>
                          <option value="paused">{t("cycle.outcome.paused")}</option>
                        </Select>
                      </Field>
                      <Field label={t("cycle.outcome-notes")} htmlFor="outcomeNotes">
                        <Textarea id="outcomeNotes" name="outcomeNotes" rows={3} />
                      </Field>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-5">
            <EmptyState
              title={t("cycle.empty.title")}
              body={t("cycle.empty.body")}
              icon={<Compass className="size-6" aria-hidden="true" />}
            />
            {goals.length > 0 ? (
              <details>
                <summary className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
                  <Plus className="size-4" aria-hidden="true" />
                  {t("cycle.create")}
                </summary>
                <div className="mt-4">
                  <ActionForm action={createCycleAction} submitLabel={t("cycle.create")}>
                    <div className="space-y-4 pb-3">
                      <Field label={t("projects.title-label")} htmlFor="cycleTitle">
                        <Input id="cycleTitle" name="title" maxLength={160} />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t("cycle.duration")} htmlFor="durationWeeks">
                          <Select
                            id="durationWeeks"
                            name="durationWeeks"
                            defaultValue={String(CYCLE_DEFAULT_WEEKS)}
                          >
                            {[2, 3, 4, 5, 6].map((weeks) => (
                              <option key={weeks} value={weeks}>
                                {t("cycle.weeks", { count: weeks })}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label={t("cycle.start-date")} htmlFor="startDate">
                          <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={todayKey(profile?.timezone ?? "UTC")}
                            required
                          />
                        </Field>
                      </div>
                      <GoalChoices goals={goals} cycleGoals={[]} mode="create" t={t} />
                    </div>
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="cycle-history" className="space-y-2">
        <h2 id="cycle-history" className="text-sm font-semibold">
          {t("cycle.history")}
        </h2>
        {pastCycles.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t("cycle.history-empty")}</p>
        ) : (
          <ul className="space-y-2">
            {pastCycles.map((cycle) => (
              <li key={cycle.id} className="surface flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {cycle.title ||
                      `${formatDateKey(cycle.start_date, locale, { dateStyle: "medium" })} – ${formatDateKey(cycle.end_date, locale, { dateStyle: "medium" })}`}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {t("cycle.weeks", { count: cycle.duration_weeks })}
                  </p>
                </div>
                <Badge tone="neutral">
                  {cycle.outcome
                    ? t(`cycle.outcome.${cycle.outcome}` as MessageKey)
                    : t("cycle.status.completed")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
