"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./feedback";

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? <Spinner label={pendingLabel} /> : children}
    </Button>
  );
}
