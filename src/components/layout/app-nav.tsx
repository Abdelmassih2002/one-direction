"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  Compass,
  FolderKanban,
  ListChecks,
  Settings,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

type NavItem = { href: string; labelKey: MessageKey; icon: LucideIcon };

const groups: { labelKey: MessageKey; items: NavItem[] }[] = [
  {
    labelKey: "nav.plan-group",
    items: [
      { href: "/app/today", labelKey: "nav.today", icon: Sun },
      { href: "/app/focus-cycle", labelKey: "nav.focus-cycle", icon: Compass },
      { href: "/app/life", labelKey: "nav.life", icon: Target },
      { href: "/app/goals", labelKey: "nav.goals", icon: Target },
      { href: "/app/projects", labelKey: "nav.projects", icon: FolderKanban },
    ],
  },
  {
    labelKey: "nav.act-group",
    items: [
      { href: "/app/tasks", labelKey: "nav.tasks", icon: ListChecks },
      { href: "/app/focus", labelKey: "nav.focus", icon: Timer },
    ],
  },
  {
    labelKey: "nav.reflect-group",
    items: [
      { href: "/app/journal", labelKey: "nav.journal", icon: BookOpen },
      { href: "/app/reviews", labelKey: "nav.reviews", icon: CalendarCheck },
      { href: "/app/insights", labelKey: "nav.insights", icon: BarChart3 },
      { href: "/app/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

export function AppNav({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();
  const { t } = useI18n();

  if (variant === "mobile") {
    return (
      <nav aria-label={t("nav.menu")} className="lg:hidden">
        <ul className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.flatMap((group) => group.items).map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium",
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={t("nav.menu")} className="space-y-6">
      {groups.map((group) => (
        <div key={group.labelKey}>
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {t(group.labelKey)}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
