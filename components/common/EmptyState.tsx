import type { LucideIcon } from "lucide-react";
import { AlertTriangle, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Empty state (spec §17): 64 px icon in a 2 px bordered circle, 20/700 title, muted body, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <span className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
        <Icon className="size-12" strokeWidth={1.25} />
      </span>
      <h2 className="mt-5 text-xl leading-[26px] font-bold">{title}</h2>
      {body && <p className="mt-2 max-w-xs text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Inline error block (spec §17): icon, short message, Try again. Never shows raw error text. */
export function ErrorState({
  message = "Couldn't load this. Check your connection and try again.",
  onRetry,
  offline,
}: {
  message?: string;
  onRetry?: () => void;
  offline?: boolean;
}) {
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className="flex flex-col items-center px-8 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="mt-3 max-w-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="surface" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
