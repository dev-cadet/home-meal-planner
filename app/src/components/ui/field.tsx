import { cn } from "@/lib/cn";

/**
 * Shared by every control here, and by DateInput in ./date-input.
 *
 * `min-w-0` matters as much as `w-full`. Form controls carry an intrinsic
 * width — a select from its longest option, a date input from its internal
 * day/month/year fields — and a grid or flex child defaults to
 * `min-width: auto`, which refuses to shrink below it. Without this a control
 * pushes past its column instead of filling it, which is what made the date
 * fields overflow their card on a phone.
 */
export const control =
  "w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong aria-[invalid]:border-danger disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "h-11", className)} {...props} />;
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
    // min-w-0 for the same reason as `control`: a Field is usually a grid or
    // flex child, and must be allowed to shrink below its content's width.
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
