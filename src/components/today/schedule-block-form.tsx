"use client";

import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { createScheduleBlockAction } from "@/server/actions/schedule";
import { idleState } from "@/server/actions/types";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ScheduleBlockForm({ date, defaultStart }: { date: string; defaultStart: string }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(createScheduleBlockAction, idleState);
  const overlap = state.messageKey === "today.overlap-warning";

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {state.status === "error" && state.messageKey ? (
        <div className="sm:col-span-2">
          <Alert tone={overlap ? "warning" : "error"}>{t(state.messageKey)}</Alert>
        </div>
      ) : null}

      <input type="hidden" name="date" value={date} />

      <Field label={t("today.block-type")} htmlFor="blockType">
        <Select id="blockType" name="blockType" defaultValue="focus">
          <option value="focus">{t("today.block.focus")}</option>
          <option value="rest">{t("today.block.rest")}</option>
          <option value="personal">{t("today.block.personal")}</option>
          <option value="commitment">{t("today.block.commitment")}</option>
        </Select>
      </Field>

      <Field label={t("today.block.title")} htmlFor="blockTitle">
        <Input id="blockTitle" name="title" maxLength={160} />
      </Field>

      <Field label={t("today.block.start")} htmlFor="startTime">
        <Input id="startTime" name="startTime" type="time" defaultValue={defaultStart} required />
      </Field>

      <Field label={t("today.block.end")} htmlFor="endTime">
        <Input id="endTime" name="endTime" type="time" required />
      </Field>

      {overlap ? (
        <label className="flex items-center gap-2 text-xs text-[var(--color-warning)] sm:col-span-2">
          <input type="checkbox" name="confirmOverlap" value="true" />
          {t("today.overlap-confirm")}
        </label>
      ) : null}

      <div className="sm:col-span-2">
        <SubmitButton type="submit" variant="secondary" size="sm">
          {t("today.add-block")}
        </SubmitButton>
      </div>
    </form>
  );
}
