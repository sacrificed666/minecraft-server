"use client";

import { useSyncExternalStore } from "react";
import { duration } from "@/lib/format";

/**
 * Reading the clock during render is impure. Subscribing to a ticking store
 * instead keeps render a pure function of its inputs.
 */
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

// Quantised to the tick interval so the snapshot is stable between ticks —
// useSyncExternalStore re-renders whenever the returned value changes.
const clientNow = () => Math.floor(Date.now() / 30_000) * 30_000;

// The server render has no meaningful clock for this; 0 renders the placeholder
// and hydration swaps in the real value.
const serverNow = () => 0;

export function Uptime({ startedAt }: { startedAt: number | null }) {
  const now = useSyncExternalStore(subscribe, clientNow, serverNow);

  if (!startedAt || !now) return <>—</>;
  return <>{duration(now - startedAt)}</>;
}
