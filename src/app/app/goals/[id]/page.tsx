import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/shared/action-form";
import { GoalStatusBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import {
  archiveGoalAction,
  updateGoalAction,
  updateGoalProgressAction,
} from "@/server/actions/goals";
import { formatDateKey } from "@/lib/time";
import type { MessageKey } from "@/lib/i18n";
import type { GoalStatus } from "@/lib/types/models";

export const metadata: Metadata = { title: "Goal" };

const STATUSES: GoalStatus[] = [
  "planned",
  "active",
  "maintenance",
  "on_hold",
  "completed",
  "archived",
];

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data: goal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!goal) notFound();

  const [areasResult, projectsResult, tasksResult, cycleGoalResult] = await Promise.all([
    supabase
      .from("life_areas")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("projects")
      .select("id, title, status")
      .eq("owner_id", user.id)
      .eq("goal_id", goal.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, scheduled_for")
      .eq("owner_id", user.id)
      .eq("goal_id", goal.id)
      .neq("status", "done")
      .neq("status", "cancelled")
      .limit(20),
    supabase
      .from("focus_cycle_goals")
      .select("role, cycle_id")
      .eq("owner_id", user.id)
      .eq("goal_id", goal.id),
  ]);

  assertRead([areasResult, projectsResult, tasksResult, cycleGoalResult], "goal");

  const areas = areasResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const openTasks = tasksResult.data ?? [];
  const cycleAssignments = cycleGoalResult.data ?? [];

  const { data: activeCycle } = await supabase
    .from("focus_cycles")
    .select("id")
    .eq("owner_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const assignment = activeCycle
    ? cycleAssignments.find((row) => row.cycle_id === activeCycle.id)
    : undefined;

  return (
    <div className="space-y-6">
      <Link
        href="/app/goals"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)]"
      >
        <ArrowLeft className="size-3.5 flip-rtl" aria-hidden="true" />
        {t("goals.title")}
      </Link>

      <PageHeader
        title={goal.title}
        subtitle={
          goal.description ??
          t("goals.detail.created", {
            date: formatDateKey(goal.created_at.slice(0, 10), locale),
          })
        }
        actions={
          <>
            <GoalStatusBadge status={goal.status} />
            {assignment ? (
              <Badge tone={assignment.role === "primary" ? "primary" : "neutral"}>
                {t(`cycle.${assignment.role === "primary" ? "primary" : assignment.role === "secondary" ? "secondary" : "maintenance"}` as MessageKey)}
              </Badge>
            ) : (
              <Badge>{t("goals.detail.not-in-cycle")}</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.detail.overview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar value={goal.progress} label={t("goals.progress")} />
              <p className="text-xs text-[var(--color-muted)]">{t("goals.progress-hint")}</p>

              <ActionForm
                action={updateGoalProgressAction}
                submitLabel={t("common.save")}
                size="sm"
                fields={{ id: goal.id }}
              >
                <div className="flex items-end gap-2 pb-2">
                  <Field label={t("goals.progress")} htmlFor="progress" className="w-28">
                    <Input
                      id="progress"
                      name="progress"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={goal.progress}
                      required
                    />
                  </Field>
                </div>
              </ActionForm>

              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-muted)]">{t("goals.life-area")}</dt>
                  <dd>{areas.find((area) => area.id === goal.life_area_id)?.name ?? t("goals.no-area")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-muted)]">{t("goals.target-date")}</dt>
                  <dd>
                    {goal.target_date ? formatDateKey(goal.target_date, locale) : t("common.not-set")}
                  </dd>
                </div>
                {goal.metric ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-muted)]">{t("goals.metric-label")}</dt>
                    <dd className="text-end">{goal.metric}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("goals.edit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={updateGoalAction}
                submitLabel={t("common.save")}
                fields={{ id: goal.id }}
              >
                <div className="space-y-3 pb-3">
                  <Field label={t("goals.title-label")} htmlFor="edit-title">
                    <Input
                      id="edit-title"
                      name="title"
                      defaultValue={goal.title}
                      required
                      maxLength={200}
                    />
                  </Field>
                  <Field label={t("goals.description-label")} htmlFor="edit-description">
                    <Textarea
                      id="edit-description"
                      name="description"
                      defaultValue={goal.description ?? ""}
                      rows={2}
                    />
                  </Field>
                  <Field label={t("goals.metric-label")} htmlFor="edit-metric">
                    <Input
                      id="edit-metric"
                      name="metric"
                      defaultValue={goal.metric ?? ""}
                      maxLength={500}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("goals.life-area")} htmlFor="edit-area">
                      <Select id="edit-area" name="lifeAreaId" defaultValue={goal.life_area_id ?? ""}>
                        <option value="">{t("goals.no-area")}</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("goals.status")} htmlFor="edit-status">
                      <Select id="edit-status" name="status" defaultValue={goal.status}>
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`goals.status.${status}` as MessageKey)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("goals.target-date")} htmlFor="edit-target">
                      <Input
                        id="edit-target"
                        name="targetDate"
                        type="date"
                        defaultValue={goal.target_date ?? ""}
                      />
                    </Field>
                    <Field label={t("goals.progress")} htmlFor="edit-progress">
                      <Input
                        id="edit-progress"
                        name="progress"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={goal.progress}
                      />
                    </Field>
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.detail.projects")}</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">{t("goals.detail.no-projects")}</p>
              ) : (
                <ul className="space-y-2">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/app/projects/${project.id}`}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
                      >
                        <span className="truncate">{project.title}</span>
                        <Badge>{t(`projects.status.${project.status}` as MessageKey)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("goals.detail.tasks")}</CardTitle>
            </CardHeader>
            <CardContent>
              {openTasks.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">{t("goals.detail.no-tasks")}</p>
              ) : (
                <ul className="space-y-2">
                  {openTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2 text-sm"
                    >
                      <span className="truncate">{task.title}</span>
                      <TaskStatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <ActionForm
            action={archiveGoalAction}
            submitLabel={goal.archived_at ? t("common.restore") : t("common.archive")}
            variant="secondary"
            fields={{ id: goal.id, archive: !goal.archived_at }}
            size="sm"
          >
            <p className="pb-2 text-xs text-[var(--color-muted)]">{t("goals.archive-body")}</p>
          </ActionForm>

          {projects.length === 0 && openTasks.length === 0 ? (
            <EmptyState title={t("goals.empty.body")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
