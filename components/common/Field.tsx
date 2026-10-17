import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Labelled form field with an optional hint or error line underneath. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Form text input on --surface, 44 px tall (comfortable on phones). */
export function TextInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("h-11 rounded-lg bg-surface px-3 text-sm dark:bg-surface", className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={cn("min-h-24 rounded-lg bg-surface px-3 py-2.5 text-sm dark:bg-surface", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}
