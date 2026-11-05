"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-lg py-16">
      <EmptyState
        title={t("errors.load-failed")}
        body={t("errors.generic")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("common.retry")}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/today">{t("nav.today")}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
