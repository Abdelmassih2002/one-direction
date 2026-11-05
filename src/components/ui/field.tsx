"use client";

import type { ComponentProps } from "react";
import { useActionFormState } from "@/components/shared/action-form";
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
  // When inside an ActionForm, automatically pick up field errors from form state.
  const autoError =
    error === undefined
      ? useActionFormState().fieldErrors?.[label.toLowerCase().replace(/[^a-z0-9]+/g, "_")]
      : undefined;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {autoError ? (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {autoError}
        </p>
      ) : null}
    </div>
  );
}
