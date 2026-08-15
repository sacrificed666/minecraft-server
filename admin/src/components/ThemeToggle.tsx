"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "system", label: "System", icon: "◐" },
  { value: "dark", label: "Dark", icon: "☾" },
];

const EVENT = "themechange";

/**
 * A blocking script in the head applies the stored theme, so the first paint is
 * already correct. This only reflects and edits that state, subscribing rather
 * than syncing in an effect so render stays pure.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const readTheme = (): Theme =>
  (localStorage.getItem("theme") as Theme | null) ?? "system";

// The server cannot know the visitor's choice; "system" matches what the
// pre-hydration script leaves on the element when nothing is stored.
const serverTheme = (): Theme => "system";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  function choose(next: Theme) {
    localStorage.setItem("theme", next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-(--glass-border) p-0.5"
      role="radiogroup"
      aria-label="Colour theme"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => choose(o.value)}
          className={`rounded-lg px-2 py-1 text-xs transition-colors ${
            theme === o.value
              ? "bg-(--glass-fill) text-ink"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
