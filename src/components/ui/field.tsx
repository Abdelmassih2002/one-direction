import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-primary)]/30 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlBase, "h-10 pe-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
