"use client";

// Shared by the lists that are long enough to need ordering.
export type SortKey = "name" | "size" | "downloads";

const LABELS: Record<SortKey, string> = {
  name: "A–Z",
  size: "Size",
  downloads: "Popular",
};

export function SortBar({
  value,
  onChange,
  keys = ["downloads", "name", "size"],
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
  keys?: SortKey[];
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-(--glass-border) p-0.5"
      role="radiogroup"
      aria-label="Sort order"
    >
      {keys.map((key) => (
        <button
          key={key}
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
            value === key
              ? "bg-(--glass-fill) text-ink"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {LABELS[key]}
        </button>
      ))}
    </div>
  );
}
