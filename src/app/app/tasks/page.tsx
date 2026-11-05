import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm, ActionButton } from "@/components/shared/action-form";
import { TaskItem } from "@/components/tasks/task-item";
import { QuickCapture } from "@/components/today/quick-capture";
import {
  createTaskAction,
  deleteTaskAction,
  rescheduleTaskAction,
  reorderTaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { sortTasks } from "@/lib/domain/tasks";
import { todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";
import type { Task, TaskStatus } from "@/lib/types/models";

export const metadata: Metadata = { title: "Tasks" };

const FILTERS: TaskStatus[] = ["inbox", "todo", "in_progress", "done", "cancelled"];

function TaskEditor({
  task,
  goals,
  projects,
  milestones,
  label,
}: {
  task: Task;
  goals: { id: string; title: string }[];
  projects: { id: string; title: string }[];
  milestones: { id: string; title: string; project_id: string }[];
  label: string;
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-[var(--color-primary)]">{label}</summary>
      <div className="pt-3">
        <ActionForm
          action={updateTaskAction}
          submitLabel={label}
          size="sm"
          fields={{ id: task.id }}
        >
          <div className="space-y-2 pb-2">
            <Field label="" htmlFor={`title-${task.id}`}>
              <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required maxLength={300} />
            </Field>
            <Field label="" htmlFor={`description-${task.id}`}>
              <Textarea
                id={`description-${task.id}`}
                name="description"
                defaultValue={task.description ?? ""}
                rows={2}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="" htmlFor={`status-${task.id}`}>
                <Select id={`status-${task.id}`} name="status" defaultValue={task.status}>
                  {FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="" htmlFor={`estimate-${task.id}`}>
                <Input
                  id={`estimate-${task.id}`}
                  name="estimateMinutes"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={task.estimate_minutes ?? ""}
                />
              </Field>
              <Field label="" htmlFor={`scheduled-${task.id}`}>
                <Input
                  id={`scheduled-${task.id}`}
                  name="scheduledFor"
                  type="date"
                  defaultValue={task.scheduled_for ?? ""}
                />
              </Field>
              <Field label="" htmlFor={`due-${task.id}`}>
                <Input
                  id={`due-${task.id}`}
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={task.due_at ? task.due_at.slice(0, 16) : ""}
                />
              </Field>
              <Field label="" htmlFor={`goal-${task.id}`}>
                <Select id={`goal-${task.id}`} name="goalId" defaultValue={task.goal_id ?? ""}>
                  <option value="">—</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="" htmlFor={`project-${task.id}`}>
                <Select id={`project-${task.id}`} name="projectId" defaultValue={task.project_id ?? ""}>
                  <option value="">—</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="" htmlFor={`milestone-${task.id}`}>
                <Select
                  id={`milestone-${task.id}`}
                  name="milestoneId"
                  defaultValue={task.milestone_id ?? ""}
                >
                  <option value="">—</option>
                  {milestones.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isTopPriority"
                defaultChecked={task.is_top_priority}
                value="true"
              />
              {label}
            </label>
          </div>
        </ActionForm>
      </div>
    </details>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reschedule?: string }>;
}) {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();
  const params = await searchParams;
  const timezone = profile?.timezone ?? "UTC";
  const today = todayKey(timezone);
  const filter = FILTERS.includes(params.status as TaskStatus)
    ? (params.status as TaskStatus)
    : null;

  const supabase = await createClient();
  const [tasksResult, goalsResult, projectsResult, milestonesResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(500),
    supabase
      .from("goals")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("archived_at", null),
    supabase.from("milestones").select("id, title, project_id").eq("owner_id", user.id),
  ]);

  assertRead([tasksResult, goalsResult, projectsResult, milestonesResult], "tasks");

  const tasks = tasksResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const milestones = milestonesResult.data ?? [];

  const inbox = tasks.filter((task) => task.status === "inbox").sort(sortTasks);
  const rescheduleTask = params.reschedule
    ? tasks.find((task) => task.id === params.reschedule)
    : undefined;

  const filtered = (filter ? tasks.filter((task) => task.status === filter) : tasks)
    .filter((task) => task.status !== "inbox" || filter === "inbox")
    .sort(sortTasks);

  const open = filtered.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const closed = filtered.filter((task) => task.status === "done" || task.status === "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("tasks.subtitle")}
        actions={
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
              <Plus className="size-4" aria-hidden="true" />
              {t("tasks.create")}
            </summary>
            <div className="surface absolute end-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] p-4 shadow-[var(--shadow-md)]">
              <ActionForm action={createTaskAction} submitLabel={t("common.create")}>
                <div className="space-y-3 pb-3">
                  <Field
                    label={t("tasks.title-label")}
                    htmlFor="new-task-title"
                  >
                    <Input id="new-task-title" name="title" required maxLength={300} />
                  </Field>
                  <Field label={t("tasks.description")} htmlFor="new-task-description">
                    <Textarea id="new-task-description" name="description" rows={2} />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label={t("tasks.goal")} htmlFor="new-task-goal">
                      <Select id="new-task-goal" name="goalId" defaultValue="">
                        <option value="">—</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("tasks.project")} htmlFor="new-task-project">
                      <Select id="new-task-project" name="projectId" defaultValue="">
                        <option value="">—</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("tasks.schedule")} htmlFor="new-task-scheduled">
                      <Input id="new-task-scheduled" name="scheduledFor" type="date" />
                    </Field>
                    <Field label={t("tasks.estimate")} htmlFor="new-task-estimate">
                      <Input id="new-task-estimate" name="estimateMinutes" type="number" min={1} />
                    </Field>
                  </div>
                  <Field label={t("tasks.status")} htmlFor="new-task-status">
                    <Select id="new-task-status" name="status" defaultValue="todo">
                      {FILTERS.map((status) => (
                        <option key={status} value={status}>
                          {t(`tasks.status.${status}` as MessageKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="isTopPriority" value="true" />
                    {t("tasks.top-priority")}
                  </label>
                </div>
              </ActionForm>
            </div>
          </details>
        }
      />

      {rescheduleTask ? (
        <Alert tone="warning" className="space-y-2">
          <p className="font-medium">{t("tasks.reschedule")}</p>
          <p className="text-xs">{t("tasks.reschedule-body")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ActionButton
              action={rescheduleTaskAction}
              fields={{ id: rescheduleTask.id, action: "tomorrow" }}
              variant="secondary"
            >
              {t("tasks.reschedule-tomorrow")}
            </ActionButton>
            <ActionButton
              action={rescheduleTaskAction}
              fields={{ id: rescheduleTask.id, action: "inbox" }}
              variant="secondary"
            >
              {t("tasks.back-to-inbox")}
            </ActionButton>
            <ActionButton
              action={rescheduleTaskAction}
              fields={{ id: rescheduleTask.id, action: "cancel" }}
              variant="secondary"
            >
              {t("tasks.cancel-task")}
            </ActionButton>
          </div>
        </Alert>
      ) : null}

      <section aria-labelledby="inbox" className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 id="inbox" className="text-sm font-semibold">
          {t("tasks.inbox")}
        </h2>
        <p className="text-xs text-[var(--color-muted)]">{t("tasks.inbox-hint")}</p>
        <QuickCapture />
        {inbox.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">{t("tasks.empty-inbox.title")}</p>
        ) : (
          <ul className="space-y-2 pt-2">
            {inbox.map((task) => (
              <TaskItem key={task.id} task={task} timezone={timezone} today={today} />
            ))}
          </ul>
        )}
      </section>

      <nav aria-label={t("tasks.filters")} className="flex flex-wrap gap-1.5">
        <Link
          href="/app/tasks"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs",
            !filter
              ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
          )}
        >
          {t("common.all")}
        </Link>
        {FILTERS.map((status) => (
          <Link
            key={status}
            href={`/app/tasks?status=${status}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs",
              filter === status
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
            )}
          >
            {t(`tasks.status.${status}` as MessageKey)}
          </Link>
        ))}
      </nav>

      {open.length === 0 && closed.length === 0 ? (
        <EmptyState
          title={filter ? t("tasks.empty-filtered") : t("tasks.empty.title")}
          body={filter ? undefined : t("tasks.empty.body")}
        />
      ) : (
        <div className="space-y-5">
          {open.length > 0 ? (
            <section aria-labelledby="open-tasks" className="space-y-2">
              <h2 id="open-tasks" className="text-sm font-semibold">
                {t("tasks.group.open")}
              </h2>
              <ul className="space-y-2">
                {open.map((task, index) => (
                  <li key={task.id}>
                    <TaskItem task={task} timezone={timezone} today={today} showPriorityToggle />
                    <div className="ms-8 flex flex-wrap items-center gap-2">
                      <ActionButton
                        action={reorderTaskAction}
                        fields={{ id: task.id, direction: "up" }}
                        ariaLabel={t("common.move-up")}
                        className={index === 0 ? "invisible" : undefined}
                      >
                        ↑
                      </ActionButton>
                      <ActionButton
                        action={reorderTaskAction}
                        fields={{ id: task.id, direction: "down" }}
                        ariaLabel={t("common.move-down")}
                        className={index === open.length - 1 ? "invisible" : undefined}
                      >
                        ↓
                      </ActionButton>
                      <ActionButton
                        action={rescheduleTaskAction}
                        fields={{ id: task.id, action: "tomorrow" }}
                      >
                        {t("tasks.reschedule-tomorrow")}
                      </ActionButton>
                      <ActionButton action={deleteTaskAction} fields={{ id: task.id }} variant="danger">
                        {t("common.delete")}
                      </ActionButton>
                    </div>
                    <TaskEditor
                      task={task}
                      goals={goals}
                      projects={projects}
                      milestones={milestones}
                      label={t("tasks.edit")}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <section aria-labelledby="done-tasks" className="space-y-2">
              <h2 id="done-tasks" className="text-sm font-semibold">
                {t("tasks.group.done")}
              </h2>
              <ul className="space-y-2">
                {closed.map((task) => (
                  <TaskItem key={task.id} task={task} timezone={timezone} today={today} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <p className="text-xs text-[var(--color-muted)]">
        {t("tasks.reschedule-body")} · {locale === "ar" ? "RTL" : "LTR"}
      </p>
    </div>
  );
}
