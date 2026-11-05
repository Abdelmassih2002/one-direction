"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl",
            "sm:inset-x-auto sm:start-1/2 sm:bottom-auto sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-lg)]",
            "rtl:sm:translate-x-1/2"
          )}
        >
          <div className="mb-4 space-y-1 pe-8">
            <DialogPrimitive.Title className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-[var(--color-text-secondary)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute end-4 top-4 rounded-full p-1 text-[var(--color-muted)] hover:bg-[var(--color-muted-soft)]"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
