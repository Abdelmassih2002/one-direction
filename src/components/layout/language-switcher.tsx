import { Languages } from "lucide-react";
import { switchLocaleAction } from "@/server/actions/locale";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/types/models";

/** Progressive-enhancement language switch: a plain form, no client JS. */
export function LanguageSwitcher({ locale, className }: { locale: Locale; className?: string }) {
  const target: Locale = locale === "ar" ? "en" : "ar";

  return (
    <form action={switchLocaleAction} className={cn("inline-flex", className)}>
      <input type="hidden" name="locale" value={target} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
        aria-label={target === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      >
        <Languages className="size-3.5" aria-hidden="true" />
        {target === "ar" ? "العربية" : "English"}
      </button>
    </form>
  );
}
