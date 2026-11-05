"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CYCLE_DEFAULT_WEEKS } from "@/lib/domain/cycle";
import { TIMEZONES } from "@/lib/date-keys";
import type { Locale, WeekStart } from "@/lib/types/models";
import { idleState, type ActionState } from "@/server/actions/types";
import { saveOnboardingPreferencesAction, finishOnboardingAction } from "@/server/actions/profile";
import { createLifeAreasBatchAction } from "@/server/actions/life";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

const TEMPLATE_KEYS = [
  "health",
  "career",
  "learning",
  "relationships",
  "finance",
  "creativity",
  "rest",
] as const;

export function OnboardingWizard({
  locale,
  timezone,
  weekStart,
  displayName,
  areas,
  startDate,
  weekStartKey,
}: {
  locale: Locale;
  timezone: string;
  weekStart: WeekStart;
  displayName: string;
  areas: { id: string; name: string }[];
  startDate: string;
  weekStartKey: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const [prefsState, prefsAction] = useActionStateStep(
    saveOnboardingPreferencesAction,
    () => setStep(2)
  );
  const [areaState, areaAction] = useActionStateStep(createLifeAreasBatchAction, () => {
    setStep(3);
    router.refresh();
  });
  const [finishState, finishAction] = useActionStateStep(finishOnboardingAction);

  const toggleTemplate = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  return (
    <div className="space-y-6">
      <ol
        className="flex items-center gap-2"
        aria-label={t("onboarding.step", { current: step, total: 3 })}
      >
        {[1, 2, 3].map((value) => (
          <li key={value} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                value < step
                  ? "bg-[var(--color-primary)] text-white"
                  : value === step
                    ? "border-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border border-[var(--color-border)] text-[var(--color-muted)]"
              )}
              aria-current={value === step ? "step" : undefined}
            >
              {value < step ? <Check className="size-3.5" aria-hidden="true" /> : value}
            </span>
            <span
              className={cn("h-0.5 flex-1 rounded-full", value < 3 ? "bg-[var(--color-border)]" : "hidden")}
              aria-hidden="true"
            />
          </li>
        ))}
      </ol>
      <p className="text-xs font-medium text-[var(--color-muted)]">
        {t("onboarding.step", { current: step, total: 3 })}
      </p>

      {step === 1 ? (
        <form action={prefsAction} className="surface space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("onboarding.step1.title")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("onboarding.step1.body")}</p>
          </div>

          {prefsState.status === "error" && prefsState.messageKey ? (
            <Alert tone="error">{t(prefsState.messageKey)}</Alert>
          ) : null}

          <Field label={t("auth.display-name")} htmlFor="displayName">
            <Input id="displayName" name="displayName" defaultValue={displayName} maxLength={120} />
          </Field>

          <Field label={t("settings.locale")} htmlFor="locale">
            <Select id="locale" name="locale" defaultValue={locale}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field label={t("settings.timezone")} htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={timezone}>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("settings.week-start")} htmlFor="weekStart">
            <Select id="weekStart" name="weekStart" defaultValue={weekStart}>
              <option value="monday">{t("settings.week-start.monday")}</option>
              <option value="sunday">{t("settings.week-start.sunday")}</option>
              <option value="saturday">{t("settings.week-start.saturday")}</option>
            </Select>
          </Field>

          <div className="flex justify-end">
            <SubmitButton type="submit" pendingLabel={t("common.saving")}>
              {t("common.continue")}
              <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form action={areaAction} className="surface space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("onboarding.step2.title")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("onboarding.step2.body")}</p>
          </div>

          {areaState.status === "error" && areaState.messageKey ? (
            <Alert tone="error">{t(areaState.messageKey)}</Alert>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-[var(--color-muted)]">
              {t("life.template-title")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_KEYS.map((key) => {
                const label = t(`life.templates.${key}` as MessageKey);
                const active = selected.includes(label);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTemplate(label)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {label}
                  </button>
                );
              })}
            </div>
            {selected.map((name) => (
              <input key={name} type="hidden" name="names" value={name} />
            ))}
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={t("onboarding.custom-area")} htmlFor="customArea" className="flex-1">
              <Input
                id="customArea"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                maxLength={80}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const trimmed = custom.trim();
                if (trimmed && !selected.includes(trimmed)) {
                  setSelected((current) => [...current, trimmed]);
                  setCustom("");
                }
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("onboarding.add-area")}
            </Button>
          </div>
          {custom.trim() ? <input type="hidden" name="names" value={custom.trim()} /> : null}

          <p className="text-xs text-[var(--color-muted)]">
            {t("onboarding.areas-selected", { count: selected.length })}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
              {t("common.back")}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                {t("onboarding.skip")}
              </Button>
              <SubmitButton type="submit" pendingLabel={t("common.saving")}>
                {t("common.continue")}
                <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
              </SubmitButton>
            </div>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form action={finishAction} className="surface space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("onboarding.step3.title")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("onboarding.step3.body")}</p>
          </div>

          {finishState.status === "error" && finishState.messageKey ? (
            <Alert tone="error">{t(finishState.messageKey)}</Alert>
          ) : null}

          <Field label={t("onboarding.goal.title")} htmlFor="goalTitle">
            <Input
              id="goalTitle"
              name="goalTitle"
              maxLength={200}
              placeholder={t("goals.title-label")}
            />
          </Field>

          {areas.length > 0 ? (
            <Field label={t("onboarding.goal.area")} htmlFor="lifeAreaId">
              <Select id="lifeAreaId" name="lifeAreaId" defaultValue="">
                <option value="">{t("goals.no-area")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={t("onboarding.cycle.duration")} htmlFor="durationWeeks">
            <Select
              id="durationWeeks"
              name="durationWeeks"
              defaultValue={String(CYCLE_DEFAULT_WEEKS)}
            >
              {[2, 3, 4, 5, 6].map((weeks) => (
                <option key={weeks} value={weeks}>
                  {t("onboarding.cycle.weeks", { count: weeks })}
                </option>
              ))}
            </Select>
          </Field>

          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="weekStartKey" value={weekStartKey} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
              {t("common.back")}
            </Button>
            <div className="flex items-center gap-2">
              <SubmitButton type="submit" variant="secondary" formNoValidate>
                {t("onboarding.skip-goal")}
              </SubmitButton>
              <SubmitButton type="submit" pendingLabel={t("common.saving")}>
                {t("onboarding.finish")}
              </SubmitButton>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Wraps a server action so a successful result advances the wizard from inside
 * the submit handler (never from a render effect).
 */
function useActionStateStep(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess?: () => void
) {
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.status === "success" && onSuccess) onSuccess();
    return result;
  }, idleState);
}
