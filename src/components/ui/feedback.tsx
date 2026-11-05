import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)]/60 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? <div className="text-[var(--color-muted)]">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        {body ? (
          <p className="mx-auto max-w-md text-sm text-[var(--color-text-secondary)]">{body}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: "error" | "success" | "warning" | "info" }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[var(--radius)] border px-3 py-2 text-sm", styles[tone], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        {subtitle ? (
          <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>{label}</span>
          <span className="tabular-nums">{clamped}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted-soft)]"
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)]">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
      />
      {label}
    </span>
  );
}
