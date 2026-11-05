import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Flag, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm, ActionButton } from "@/components/shared/action-form";
import { ProjectStatusBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import {
  addMilestoneAction,
  deleteMilestoneAction,
  setMilestoneStatusAction,
  setProjectStatusAction,
  updateProjectAction,
} from "@/server/actions/projects";
import { completionPercent } from "@/lib/domain/tasks";
import { formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) notFound();

  const [milestonesResult, tasksResult, goalsResult] = await Promise.all([
    supabase
      .from("milestones")
      .select("*")
      .eq("owner_id", user.id)
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("owner_id", user.id)
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("goals")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("archived_at", null),
  ]);

  assertRead([milestonesResult, tasksResult, goalsResult], "project");

  const milestones = milestonesResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const percent = completionPercent(tasks);
  const currentMilestone = milestones.find((milestone) => milestone.status === "open");

  return (
    <div className="space-y-6">
      <Link
        href="/app/projects"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)]"
      >
        <ArrowLeft className="size-3.5 flip-rtl" aria-hidden="true" />
        {t("projects.back")}
      </Link>

      <PageHeader
        title={project.title}
        subtitle={project.description ?? undefined}
        actions={
          <>
            <ProjectStatusBadge status={project.status} />
            <Badge>{goals.find((goal) => goal.id === project.goal_id)?.title ?? t("projects.no-goal")}</Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("projects.milestones")}</CardTitle>
              {currentMilestone ? (
                <span className="text-xs text-[var(--color-muted)]">
                  {t("projects.milestone-current")}: {currentMilestone.title}
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {milestones.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">{t("projects.milestone-empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-3 py-2",
                        milestone.id === currentMilestone?.id
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40"
                          : "border-[var(--color-border-soft)]"
                      )}
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm",
                            milestone.status === "done" && "text-[var(--color-muted)] line-through"
                          )}
                        >
                          {milestone.title}
                        </p>
                        {milestone.due_on ? (
                          <p className="text-xs text-[var(--color-muted)]">
                            {formatDateKey(milestone.due_on, locale, { dateStyle: "medium" })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <ActionButton
                          action={setMilestoneStatusAction}
                          fields={{
                            id: milestone.id,
                            status: milestone.status === "done" ? "open" : "done",
                          }}
                          ariaLabel={t("common.done")}
                        >
                          <Check
                            className={cn(
                              "size-3.5",
                              milestone.status === "done" && "text-[var(--color-success)]"
                            )}
                            aria-hidden="true"
                          />
                        </ActionButton>
                        <ActionButton
                          action={deleteMilestoneAction}
                          fields={{ id: milestone.id }}
                          ariaLabel={t("common.delete")}
                        >
                          ×
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <details>
                <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t("projects.milestone-add")}
                </summary>
                <div className="pt-3">
                  <ActionForm
                    action={addMilestoneAction}
                    submitLabel={t("common.add")}
                    size="sm"
                    fields={{ projectId: project.id }}
                  >
                    <div className="space-y-2 pb-2">
                      <Field label={t("projects.milestone-title")} htmlFor="milestone-title">
                        <Input id="milestone-title" name="title" required maxLength={200} />
                      </Field>
                      <Field label={t("projects.due-on")} htmlFor="milestone-due">
                        <Input id="milestone-due" name="dueOn" type="date" />
                      </Field>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.open-tasks")}</CardTitle>
              <span className="text-xs text-[var(--color-muted)]">
                {t("common.items", { count: openTasks.length })}
              </span>
            </CardHeader>
            <CardContent>
              {openTasks.length === 0 ? (
                <EmptyState title={t("tasks.empty.title")} body={t("tasks.empty.body")} />
              ) : (
                <ul className="space-y-2">
                  {openTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.title}</p>
                        {task.scheduled_for ? (
                          <p className="text-xs text-[var(--color-muted)]">
                            {formatDateKey(task.scheduled_for, locale, { dateStyle: "short" })}
                          </p>
                        ) : null}
                      </div>
                      <TaskStatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/app/tasks"
                className="mt-3 inline-block text-xs text-[var(--color-primary)] hover:underline"
              >
                {t("nav.tasks")}
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("projects.progress")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar value={percent} label={t("projects.progress")} />
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)] p-2">
                  <dt className="text-[var(--color-muted)]">{t("projects.progress")}</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {percent}%
                  </dd>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)] p-2">
                  <dt className="text-[var(--color-muted)]">{t("projects.milestones")}</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {milestones.filter((milestone) => milestone.status === "done").length}/
                    {milestones.length}
                  </dd>
                </div>
              </dl>

              <ActionForm
                action={setProjectStatusAction}
                submitLabel={t("common.save")}
                size="sm"
                fields={{ id: project.id }}
              >
                <div className="space-y-2 pb-2">
                  <Field label={t("projects.status")} htmlFor="status">
                    <Select id="status" name="status" defaultValue={project.status}>
                      {["planned", "active", "on_hold", "completed", "archived"].map((status) => (
                        <option key={status} value={status}>
                          {t(`projects.status.${status}` as MessageKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="text-xs text-[var(--color-muted)]">{t("projects.archive-body")}</p>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.edit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateProjectAction} submitLabel={t("common.save")} fields={{ id: project.id }}>
                <div className="space-y-3 pb-3">
                  <Field label={t("projects.title-label")} htmlFor="edit-project-title">
                    <Input
                      id="edit-project-title"
                      name="title"
                      defaultValue={project.title}
                      required
                      maxLength={200}
                    />
                  </Field>
                  <Field label={t("projects.description")} htmlFor="edit-project-description">
                    <Textarea
                      id="edit-project-description"
                      name="description"
                      defaultValue={project.description ?? ""}
                      rows={2}
                    />
                  </Field>
                  <Field label={t("projects.linked-goal")} htmlFor="edit-project-goal">
                    <Select id="edit-project-goal" name="goalId" defaultValue={project.goal_id ?? ""}>
                      <option value="">{t("projects.no-goal")}</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <input type="hidden" name="status" value={project.status} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("projects.starts-on")} htmlFor="edit-starts">
                      <Input
                        id="edit-starts"
                        name="startsOn"
                        type="date"
                        defaultValue={project.starts_on ?? ""}
                      />
                    </Field>
                    <Field label={t("projects.due-on")} htmlFor="edit-due">
                      <Input id="edit-due" name="dueOn" type="date" defaultValue={project.due_on ?? ""} />
                    </Field>
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          {currentMilestone ? (
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <Flag className="size-3.5" aria-hidden="true" />
              {currentMilestone.title}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
