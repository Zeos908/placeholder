import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Login/sign-up input (spec §17): --surface background, 8 px radius, 38 px tall, label for screen readers. */
export function AuthField({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <Input
        {...props}
        placeholder={label}
        className={cn("h-[38px] rounded-lg border-border bg-surface px-2.5 text-[13px] dark:bg-surface", className)}
      />
    </label>
  );
}
