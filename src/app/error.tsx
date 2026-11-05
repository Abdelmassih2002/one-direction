"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4">
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
              <Link href="/">{t("app.name")}</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
