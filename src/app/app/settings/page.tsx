import type { Metadata } from "next";
import { Download, ShieldCheck } from "lucide-react";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/shared/action-form";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { updateProfileAction } from "@/server/actions/profile";
import { signOutAction } from "@/server/actions/auth";
import { TIMEZONES } from "@/lib/date-keys";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("settings.profile")}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateProfileAction} submitLabel={t("common.save")} showSuccess>
              <div className="space-y-3 pb-3">
                <Field label={t("settings.display-name")} htmlFor="displayName">
                  <Input
                    id="displayName"
                    name="displayName"
                    defaultValue={profile?.display_name ?? ""}
                    required
                    maxLength={120}
                  />
                </Field>
                <Field label={t("settings.locale")} htmlFor="locale">
                  <Select id="locale" name="locale" defaultValue={profile?.locale ?? locale}>
                    <option value="ar">{t("settings.language.ar")}</option>
                    <option value="en">{t("settings.language.en")}</option>
                  </Select>
                </Field>
                <Field label={t("settings.timezone")} htmlFor="timezone">
                  <Select id="timezone" name="timezone" defaultValue={profile?.timezone ?? "UTC"}>
                    {TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("settings.week-start")} htmlFor="weekStart">
                  <Select id="weekStart" name="weekStart" defaultValue={profile?.week_start ?? "monday"}>
                    <option value="monday">{t("settings.week-start.monday")}</option>
                    <option value="sunday">{t("settings.week-start.sunday")}</option>
                    <option value="saturday">{t("settings.week-start.saturday")}</option>
                  </Select>
                </Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.export")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[var(--color-text-secondary)]">{t("settings.export-body")}</p>
              <Button asChild variant="secondary">
                <a href="/api/export" download>
                  <Download className="size-4 flip-rtl" aria-hidden="true" />
                  {t("settings.export-download")}
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.privacy-title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <ShieldCheck
                className="size-5 shrink-0 text-[var(--color-primary)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("settings.privacy-body")}
              </p>
            </CardContent>
          </Card>

          <form action={signOutAction}>
            <Button type="submit" variant="secondary" block>
              {t("settings.sign-out")}
            </Button>
          </form>
        </div>
      </div>

      <Card className="border-[var(--color-danger)]/30">
        <CardHeader>
          <div>
            <CardTitle className="text-[var(--color-danger)]">{t("settings.delete")}</CardTitle>
            <CardDescription>{t("settings.delete-body")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-[var(--color-muted)]">{t("settings.delete-title")}</p>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
