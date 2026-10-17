import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent-gradient text-white hover:opacity-90",
  secondary:
    "border border-border bg-background text-foreground hover:bg-surface",
  ghost: "text-foreground hover:bg-surface",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  className,
  pending,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; pending?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground " +
  "focus:border-neutral-400 focus:outline-none dark:focus:border-neutral-600";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, "h-11", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(FIELD, "min-h-24 py-2.5", className)} />;
}

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
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    success:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
    info: "border-border bg-surface text-foreground",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-3 py-2.5 text-sm", styles)}>
      {children}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1.5 text-sm transition",
        selected
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

export { cx };
