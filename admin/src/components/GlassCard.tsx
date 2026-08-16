import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  delay = 0,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  // Stagger index for the entrance animation.
  delay?: number;
  hover?: boolean;
}) {
  return (
    <section
      className={`glass rise ${hover ? "glass-hover" : ""} ${className}`}
      style={{ animationDelay: `${Math.min(delay, 6) * 45}ms` }}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  accent,
  right,
}: {
  title: string;
  hint?: string;
  // CSS colour for the series dot that ties the header to its chart.
  accent?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          {accent && (
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: accent }}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{title}</span>
        </h2>
        {hint && (
          <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
        )}
      </div>
      {right}
    </header>
  );
}
