import type { Metadata } from "next";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ActionForm, ActionButton } from "@/components/shared/action-form";
import { Field, Input } from "@/components/ui/field";
import {
  createLifeAreaAction,
  reorderLifeAreaAction,
  setLifeAreaArchivedAction,
  updateLifeAreaAction,
} from "@/server/actions/life";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "My Life" };

const TEMPLATES: { key: MessageKey; color: string }[] = [
  { key: "life.templates.health", color: "#1c7a52" },
  { key: "life.templates.career", color: "#1f5f4d" },
  { key: "life.templates.learning", color: "#2b6cb0" },
  { key: "life.templates.relationships", color: "#b3265e" },
  { key: "life.templates.finance", color: "#9a5b13" },
  { key: "life.templates.creativity", color: "#7c5cbf" },
  { key: "life.templates.rest", color: "#c2703d" },
];

export default async function LifePage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const supabase = await createClient();

  const [areasResult, goalsResult] = await Promise.all([
    supabase
      .from("life_areas")
      .select("*")
      .eq("owner_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase.from("goals").select("id, life_area_id, archived_at").eq("owner_id", user.id),
  ]);

  assertRead([areasResult, goalsResult], "life areas");

  const areas = areasResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const activeAreas = areas.filter((area) => !area.archived_at);
  const archivedAreas = areas.filter((area) => area.archived_at);

  const goalCount = (areaId: string) =>
    goals.filter((goal) => goal.life_area_id === areaId && !goal.archived_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("life.title")}
        subtitle={t("life.subtitle")}
        actions={
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
              <Plus className="size-4" aria-hidden="true" />
              {t("life.create")}
            </summary>
            <div className="surface absolute end-0 z-20 mt-2 w-72 p-4 shadow-[var(--shadow-md)]">
              <ActionForm action={createLifeAreaAction} submitLabel={t("common.create")}>
                {(state) => (
                  <div className="space-y-3 pb-3">
                    <Field
                      label={t("life.name")}
                      htmlFor="area-name"
                      error={state.fieldErrors?.name ? t("life.errors.name") : undefined}
                    >
                      <Input id="area-name" name="name" required maxLength={80} />
                    </Field>
                    <Field label={t("life.color")} htmlFor="area-color">
                      <Input
                        id="area-color"
                        name="color"
                        type="color"
                        defaultValue="#1f5f4d"
                        className="h-9 w-16 p-1"
                      />
                    </Field>
                  </div>
                )}
              </ActionForm>
            </div>
          </details>
        }
      />

      {activeAreas.length === 0 ? (
        <EmptyState
          title={t("life.empty.title")}
          body={t("life.empty.body")}
          icon={<Plus className="size-6" aria-hidden="true" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {activeAreas.map((area, index) => (
            <li key={area.id} className="surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: area.color ?? "#1f5f4d" }}
                  />
                  <p className="truncate text-sm font-semibold">{area.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <ActionButton
                    action={reorderLifeAreaAction}
                    fields={{ id: area.id, direction: "up" }}
                    ariaLabel={t("common.move-up")}
                    className={index === 0 ? "invisible" : undefined}
                  >
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  </ActionButton>
                  <ActionButton
                    action={reorderLifeAreaAction}
                    fields={{ id: area.id, direction: "down" }}
                    ariaLabel={t("common.move-down")}
                    className={index === activeAreas.length - 1 ? "invisible" : undefined}
                  >
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </ActionButton>
                </div>
              </div>

              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {t("life.goals-count", { count: goalCount(area.id) })}
              </p>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-[var(--color-primary)]">
                  {t("common.edit")}
                </summary>
                <div className="space-y-3 pt-3">
                  <ActionForm
                    action={updateLifeAreaAction}
                    submitLabel={t("common.save")}
                    size="sm"
                    fields={{ id: area.id }}
                  >
                    <div className="space-y-2 pb-2">
                      <Field label={t("life.name")} htmlFor={`name-${area.id}`}>
                        <Input
                          id={`name-${area.id}`}
                          name="name"
                          defaultValue={area.name}
                          required
                          maxLength={80}
                        />
                      </Field>
                      <Field label={t("life.color")} htmlFor={`color-${area.id}`}>
                        <Input
                          id={`color-${area.id}`}
                          name="color"
                          type="color"
                          defaultValue={area.color ?? "#1f5f4d"}
                          className="h-9 w-16 p-1"
                        />
                      </Field>
                    </div>
                  </ActionForm>
                  <ActionButton
                    action={setLifeAreaArchivedAction}
                    fields={{ id: area.id, archived: true }}
                    variant="ghost"
                    ariaLabel={t("life.archive")}
                  >
                    {t("life.archive")}
                  </ActionButton>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="suggested" className="space-y-2">
        <h2 id="suggested" className="text-sm font-semibold">
          {t("life.template-title")}
        </h2>
        <p className="text-xs text-[var(--color-muted)]">{t("life.template-hint")}</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <ActionButton
              key={template.key}
              action={createLifeAreaAction}
              fields={{ name: t(template.key), color: template.color }}
              variant="secondary"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t(template.key)}
            </ActionButton>
          ))}
        </div>
      </section>

      {archivedAreas.length > 0 ? (
        <section aria-labelledby="archived-areas" className="space-y-2">
          <h2 id="archived-areas" className="text-sm font-semibold">
            {t("life.archived")}
          </h2>
          <ul className="space-y-2">
            {archivedAreas.map((area) => (
              <li
                key={area.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border-soft)] bg-[var(--color-surface-secondary)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge>{t("common.archived")}</Badge>
                  <span className="text-sm">{area.name}</span>
                </div>
                <ActionButton
                  action={setLifeAreaArchivedAction}
                  fields={{ id: area.id, archived: false }}
                  variant="ghost"
                >
                  {t("life.restore")}
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
