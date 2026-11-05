import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/shared/action-form";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { createProjectAction } from "@/server/actions/projects";
import { completionPercent } from "@/lib/domain/tasks";
import { formatDateKey } from "@/lib/time";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const [projectsResult, goalsResult, tasksResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("goals")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("id, project_id, status").eq("owner_id", user.id),
  ]);

  assertRead([projectsResult, goalsResult, tasksResult], "projects");

  const projects = (projectsResult.data ?? []).filter((project) => !project.archived_at);
  const goals = goalsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("projects.title")}
        subtitle={t("projects.subtitle")}
        actions={
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
              <Plus className="size-4" aria-hidden="true" />
              {t("projects.create")}
            </summary>
            <div className="surface absolute end-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4 shadow-[var(--shadow-md)]">
              <ActionForm action={createProjectAction} submitLabel={t("common.create")}>
                <div className="space-y-3 pb-3">
                  <Field
                    label={t("projects.title-label")}
                    htmlFor="project-title"
                  >
                    <Input id="project-title" name="title" required maxLength={200} />
                  </Field>
                  <Field label={t("projects.linked-goal")} htmlFor="project-goal">
                    <Select id="project-goal" name="goalId" defaultValue="">
                      <option value="">{t("projects.no-goal")}</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("projects.status")} htmlFor="project-status">
                    <Select id="project-status" name="status" defaultValue="active">
                      {["planned", "active", "on_hold", "completed"].map((status) => (
                        <option key={status} value={status}>
                          {t(`projects.status.${status}` as MessageKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("projects.description")} htmlFor="project-description">
                    <Textarea id="project-description" name="description" rows={2} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </details>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title={t("projects.empty.title")}
          body={t("projects.empty.body")}
          icon={<Plus className="size-6" aria-hidden="true" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const projectTasks = tasks.filter((task) => task.project_id === project.id);
            const percent = completionPercent(projectTasks);
            return (
              <li key={project.id} className="surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/app/projects/${project.id}`}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {project.title}
                  </Link>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {goals.find((goal) => goal.id === project.goal_id)?.title ?? t("projects.no-goal")}
                  {project.due_on ? ` · ${formatDateKey(project.due_on, locale)}` : ""}
                </p>
                <ProgressBar value={percent} label={t("projects.progress")} className="mt-3" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
