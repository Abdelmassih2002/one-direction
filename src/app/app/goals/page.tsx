import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm, ActionButton } from "@/components/shared/action-form";
import { GoalStatusBadge } from "@/components/shared/status-badge";
import { createGoalAction, archiveGoalAction } from "@/server/actions/goals";
import { formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";
import type { GoalStatus } from "@/lib/types/models";

export const metadata: Metadata = { title: "Goals" };

const STATUSES: GoalStatus[] = [
  "planned",
  "active",
  "maintenance",
  "on_hold",
  "completed",
  "archived",
];

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status as GoalStatus)
    ? (params.status as GoalStatus)
    : null;

  const supabase = await createClient();
  const [goalsResult, areasResult] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("life_areas")
      .select("id, name")
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  assertRead([goalsResult, areasResult], "goals");

  const goals = goalsResult.data ?? [];
  const areas = areasResult.data ?? [];
  const visible = goals.filter((goal) => {
    if (statusFilter) return goal.status === statusFilter;
    return !goal.archived_at;
  });
  const areaName = (id: string | null) => areas.find((area) => area.id === id)?.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("goals.title")}
        subtitle={t("goals.subtitle")}
        actions={
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
              <Plus className="size-4" aria-hidden="true" />
              {t("goals.create")}
            </summary>
            <div className="surface absolute end-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4 shadow-[var(--shadow-md)]">
              <ActionForm action={createGoalAction} submitLabel={t("common.create")}>
                <div className="space-y-3 pb-3">
                  <Field
                    label={t("goals.title-label")}
                    htmlFor="goal-title"
                  >
                    <Input id="goal-title" name="title" required maxLength={200} />
                  </Field>
                  <Field label={t("goals.life-area")} htmlFor="goal-area">
                    <Select id="goal-area" name="lifeAreaId" defaultValue="">
                      <option value="">{t("goals.no-area")}</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("goals.status")} htmlFor="goal-status">
                    <Select id="goal-status" name="status" defaultValue="planned">
                      {STATUSES.filter((status) => status !== "archived").map((status) => (
                        <option key={status} value={status}>
                          {t(`goals.status.${status}` as MessageKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("goals.target-date")} htmlFor="goal-date">
                    <Input id="goal-date" name="targetDate" type="date" />
                  </Field>
                  <Field label={t("goals.description-label")} htmlFor="goal-description">
                    <Textarea id="goal-description" name="description" rows={2} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </details>
        }
      />

      <nav aria-label={t("common.filter")} className="flex flex-wrap gap-1.5">
        <Link
          href="/app/goals"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs",
            !statusFilter
              ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
          )}
        >
          {t("common.all")}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/app/goals?status=${status}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs",
              statusFilter === status
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
            )}
          >
            {t(`goals.status.${status}` as MessageKey)}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          title={statusFilter ? t("goals.empty-filtered") : t("goals.empty.title")}
          body={statusFilter ? undefined : t("goals.empty.body")}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((goal) => (
            <li key={goal.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/app/goals/${goal.id}`}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {goal.title}
                    </Link>
                    <GoalStatusBadge status={goal.status} />
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    {areaName(goal.life_area_id) ?? t("goals.no-area")}
                    {goal.target_date
                      ? ` · ${formatDateKey(goal.target_date, locale, { dateStyle: "medium" })}`
                      : ""}
                  </p>
                  {goal.metric ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">{goal.metric}</p>
                  ) : null}
                </div>
                <div className="flex w-full max-w-[14rem] flex-col gap-2">
                  <ProgressBar value={goal.progress} label={t("goals.progress")} />
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/app/goals/${goal.id}`}
                      className="rounded-full px-2 py-1 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t("common.edit")}
                    </Link>
                    <ActionButton
                      action={archiveGoalAction}
                      fields={{ id: goal.id, archive: !goal.archived_at }}
                    >
                      {goal.archived_at ? t("common.restore") : t("common.archive")}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {statusFilter === "archived" ? (
        <p className="text-xs text-[var(--color-muted)]">{t("goals.archived-note")}</p>
      ) : null}
    </div>
  );
}
