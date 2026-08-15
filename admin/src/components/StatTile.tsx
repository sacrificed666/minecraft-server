import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  suffix,
  detail,
  accent,
  delay = 0,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail?: ReactNode;
  accent?: string;
  delay?: number;
}) {
  return (
    <div
      className="glass glass-hover rise p-5"
      style={{ animationDelay: `${Math.min(delay, 6) * 45}ms` }}
    >
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-secondary uppercase">
        {accent && (
          <span
            className="size-2 rounded-xs"
            style={{ background: accent }}
            aria-hidden="true"
          />
        )}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span key={value} className="value-in text-3xl font-semibold tracking-tight text-ink">
          {value}
        </span>
        {suffix && (
          <span className="text-sm text-ink-muted">{suffix}</span>
        )}
      </div>
      {detail && <div className="mt-1 text-xs text-ink-muted">{detail}</div>}
    </div>
  );
}

/**
 * A ratio against a fixed limit — the right form for memory. Aikar's flags
 * include AlwaysPreTouch, so the heap is committed at startup and a time series
 * would be flat forever; a meter still shows headroom.
 */
export function Meter({
  used,
  limit,
  label,
  format,
  delay = 0,
}: {
  used: number;
  limit: number;
  label: string;
  format: (bytes: number) => string;
  delay?: number;
}) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(ratio * 100);
  const state = ratio > 0.94 ? "critical" : ratio > 0.85 ? "warning" : "good";
  const color = `var(--${state})`;

  return (
    <div
      className="glass glass-hover rise p-5"
      style={{ animationDelay: `${Math.min(delay, 6) * 45}ms` }}
    >
      <div className="flex items-center justify-between text-xs font-medium tracking-wide text-ink-secondary uppercase">
        <span>{label}</span>
        <span className="tabular-nums text-ink-muted normal-case">
          {percent}%
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span key={format(used)} className="value-in text-3xl font-semibold tracking-tight text-ink">
          {format(used)}
        </span>
        <span className="text-sm text-ink-muted">/ {format(limit)}</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-(--grid)"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-(--glass-border) px-3 py-1 text-xs font-medium"
      style={{ color: online ? "var(--good)" : "var(--critical)" }}
    >
      <span
        className={`relative size-2 rounded-full ${online ? "pulse-dot" : ""}`}
        style={{ background: "currentColor" }}
        aria-hidden="true"
      />
      {/* Icon + label, never colour alone */}
      {online ? "Online" : "Unreachable"}
    </span>
  );
}
