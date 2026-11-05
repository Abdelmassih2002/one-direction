"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Pause, Play, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  elapsedSeconds,
  formatClock,
  remainingSeconds,
  TIMER_PRESETS,
} from "@/lib/domain/timer";
import {
  endSessionAction,
  pauseSessionAction,
  recordInterruptionAction,
  resumeSessionAction,
  startSessionAction,
} from "@/server/actions/focus";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FocusSession, Task } from "@/lib/types/models";

const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;

function subscribeClock(listener: () => void) {
  if (clockListeners.size === 0) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const notify of clockListeners) notify();
    }, 1000);
  }
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => 0
  );
}

function toTimestamps(session: FocusSession) {
  return {
    startedAt: session.started_at,
    pausedAt: session.paused_at,
    resumedAt: session.resumed_at,
    endedAt: session.ended_at,
    accumulatedSeconds: session.accumulated_seconds,
    actualSeconds: session.actual_seconds,
    status: session.status,
  };
}

function ActiveTimer({ session, taskTitle }: { session: FocusSession; taskTitle: string }) {
  const { t } = useI18n();
  const now = useNow();

  const [pauseState, pauseAction] = useActionState(pauseSessionAction, idleState);
  const [resumeState, resumeAction] = useActionState(resumeSessionAction, idleState);
  const [endState, endAction] = useActionState(endSessionAction, idleState);
  const [interruptionState, interruptionAction] = useActionState(
    recordInterruptionAction,
    idleState
  );

  const timestamps = toTimestamps(session);
  // The clock is an external store: elapsed time always derives from stored
  // timestamps, so a reload or a background tab cannot drift (TIMER-03).
  const elapsed = now <= 0 ? session.accumulated_seconds : elapsedSeconds(timestamps, now);
  const remaining = remainingSeconds(elapsed, session.planned_seconds);
  const progress = Math.min(100, (elapsed / Math.max(1, session.planned_seconds)) * 100);
  const paused = session.status === "paused";
  const error = pauseState.messageKey ?? resumeState.messageKey ?? endState.messageKey ?? interruptionState.messageKey;

  return (
    <div className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {paused ? t("focus.paused") : t("focus.active")}
        </p>
        <p className="text-sm font-medium">{taskTitle}</p>
      </div>

      <div className="text-center">
        <p className="text-5xl font-semibold tabular-nums" dir="ltr" aria-live="polite">
          {formatClock(elapsed)}
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t("focus.remaining")}: {formatClock(remaining)} · {t("focus.interruptions")}:{" "}
          {session.interruptions}
        </p>
        <div className="mx-auto mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[var(--color-muted-soft)]">
          <div
            className="h-full rounded-full bg-[var(--color-primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error ? <Alert tone="error">{t(error)}</Alert> : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {paused ? (
          <form action={resumeAction}>
            <input type="hidden" name="id" value={session.id} />
            <SubmitButton type="submit" pendingLabel={t("common.saving")}>
              <Play className="size-4" aria-hidden="true" />
              {t("focus.resume")}
            </SubmitButton>
          </form>
        ) : (
          <form action={pauseAction}>
            <input type="hidden" name="id" value={session.id} />
            <SubmitButton type="submit" variant="secondary" pendingLabel={t("common.saving")}>
              <Pause className="size-4" aria-hidden="true" />
              {t("focus.pause")}
            </SubmitButton>
          </form>
        )}

        <form action={interruptionAction}>
          <input type="hidden" name="id" value={session.id} />
          <SubmitButton type="submit" variant="ghost" size="sm">
            {t("focus.add-interruption")}
          </SubmitButton>
        </form>
      </div>

      <form action={endAction} className="space-y-3 border-t border-[var(--color-border-soft)] pt-4">
        <input type="hidden" name="id" value={session.id} />
        <Field label={t("focus.notes")} htmlFor="session-notes">
          <Textarea id="session-notes" name="notes" rows={2} maxLength={2000} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <SubmitButton type="submit" variant="primary" pendingLabel={t("common.saving")}>
            <Square className="size-4" aria-hidden="true" />
            {t("focus.complete")}
          </SubmitButton>
        </div>
      </form>

      <p className="text-center text-xs text-[var(--color-muted)]">{t("focus.ended-note")}</p>
    </div>
  );
}

export function FocusTimer({
  session,
  activeTask,
  tasks,
  defaultMinutes,
  lastDuration,
}: {
  session: FocusSession | null;
  activeTask: Task | null;
  tasks: Task[];
  defaultMinutes: number;
  lastDuration: number | null;
}) {
  const { t } = useI18n();
  const [startState, startAction] = useActionState(startSessionAction, idleState);

  if (session) {
    return (
      <ActiveTimer session={session} taskTitle={activeTask?.title ?? t("focus.no-task")} />
    );
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {lastDuration !== null ? (
        <Alert tone="success">{t("focus.completed")} · {formatClock(lastDuration)}</Alert>
      ) : null}
      {startState.status === "error" && startState.messageKey ? (
        <Alert tone="error">{t(startState.messageKey)}</Alert>
      ) : null}

      <form action={startAction} className="space-y-4">
        <Field label={t("focus.select-task")} htmlFor="taskId">
          <Select id="taskId" name="taskId" required defaultValue={tasks[0]?.id ?? ""}>
            {tasks.length === 0 ? <option value="">{t("tasks.empty.title")}</option> : null}
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("focus.custom-minutes")} htmlFor="plannedMinutes">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="plannedMinutes"
              name="plannedMinutes"
              type="number"
              min={1}
              max={240}
              defaultValue={defaultMinutes}
              className="w-24"
            />
            <div className="flex flex-wrap gap-1">
              {TIMER_PRESETS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    const input = form?.querySelector<HTMLInputElement>("#plannedMinutes");
                    if (input) input.value = String(minutes);
                  }}
                >
                  {minutes}
                </Button>
              ))}
            </div>
          </div>
        </Field>

        <SubmitButton type="submit" block pendingLabel={t("common.saving")} disabled={tasks.length === 0}>
          <Play className="size-4" aria-hidden="true" />
          {t("focus.start")}
        </SubmitButton>
      </form>

      <p className="text-xs text-[var(--color-muted)]">{t("focus.no-blocking")}</p>
    </div>
  );
}


