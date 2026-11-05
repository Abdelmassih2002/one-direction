import { useI18n } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import type { MessageKey } from "@/lib/i18n";

const goalTones: Record<string, "neutral" | "primary" | "success" | "warning"> = {
  planned: "neutral",
  active: "primary",
  maintenance: "success",
  on_hold: "warning",
  completed: "success",
  archived: "neutral",
};

const taskTones: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  inbox: "neutral",
  todo: "primary",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

const projectTones: Record<string, "neutral" | "primary" | "success" | "warning"> = {
  planned: "neutral",
  active: "primary",
  on_hold: "warning",
  completed: "success",
  archived: "neutral",
};

export function GoalStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge tone={goalTones[status] ?? "neutral"}>{t(`goals.status.${status}` as MessageKey)}</Badge>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge tone={taskTones[status] ?? "neutral"}>
      {t(`tasks.status.${status}` as MessageKey)}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge tone={projectTones[status] ?? "neutral"}>
      {t(`projects.status.${status}` as MessageKey)}
    </Badge>
  );
}
