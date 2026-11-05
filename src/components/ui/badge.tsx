import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-[var(--color-muted-soft)] text-[var(--color-text-secondary)]",
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  success: "bg-[var(--color-accent-soft)] text-[var(--color-success)]",
  warning: "bg-amber-50 text-[var(--color-warning)]",
  danger: "bg-red-50 text-[var(--color-danger)]",
} as const;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
