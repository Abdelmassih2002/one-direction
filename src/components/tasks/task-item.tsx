"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Clock, Star, Timer } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { setTaskStatusAction, toggleTopPriorityAction } from "@/server/actions/tasks";
import { idleState } from "@/server/actions/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/shared/action-form";
import { localDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/models";

export function TaskItem({
  task,
  timezone,
  today,
  showPriorityToggle = false,
  className,
}: {
  task: Task;
  timezone: string;
  today: string;
  showPriorityToggle?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [statusState, statusAction] = useActionState(setTaskStatusAction, idleState);
  const done = task.status === "done";
  const overdue = Boolean(
    task.due_at && !done && localDateKey(task.due_at, timezone) < today
  );

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3",
        className
      )}
    >
      <form action={statusAction}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <button
          type="submit"
          aria-label={done ? t("tasks.reopen") : t("tasks.complete")}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] transition-colors",
            done
              ? "border-[var(--color-success)] bg-[var(--color-success)] text-white"
              : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
          )}
        >
          {done ? "✓" : ""}
        </button>
      </form>

      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={cn(
            "text-sm",
            done ? "text-[var(--color-muted)] line-through" : "font-medium"
          )}
        >
          {task.title}
        </p>
        {statusState.status === "error" && statusState.messageKey ? (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {t(statusState.messageKey)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
          {task.is_top_priority ? (
            <Badge tone="primary" className="gap-1">
              <Star className="size-3" aria-hidden="true" />
              {t("tasks.top-priority")}
            </Badge>
          ) : null}
          {task.estimate_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" />
              {t("common.minutes", { count: task.estimate_minutes })}
            </span>
          ) : null}
          {task.due_at ? (
            <span className={cn(overdue && "font-medium text-[var(--color-danger)]")}>
              {new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
                dateStyle: "short",
                timeZone: timezone,
              }).format(new Date(task.due_at))}
            </span>
          ) : null}
          {task.status === "in_progress" ? (
            <Badge tone="warning">{t("tasks.status.in_progress")}</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!done ? (
          <Button asChild variant="ghost" size="sm" aria-label={t("tasks.start-focus")}>
            <Link href={`/app/focus?taskId=${task.id}`}>
              <Timer className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        {showPriorityToggle ? (
          <ActionButton
            action={toggleTopPriorityAction}
            fields={{ id: task.id, isTopPriority: !task.is_top_priority }}
            variant="ghost"
            size="sm"
            ariaLabel={task.is_top_priority ? t("tasks.remove-top") : t("tasks.make-top")}
          >
            <Star
              className={cn(
                "size-3.5",
                task.is_top_priority
                  ? "fill-[var(--color-accent)] text-[var(--color-accent)]"
                  : "text-[var(--color-muted)]"
              )}
              aria-hidden="true"
            />
          </ActionButton>
        ) : null}
      </div>
    </li>
  );
}
