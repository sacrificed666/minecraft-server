"use client";

import { useSyncExternalStore } from "react";
import { duration } from "@/lib/format";

// Reading the clock during render is impure.
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

// Quantised, because useSyncExternalStore re-renders on every changed value.
const clientNow = () => Math.floor(Date.now() / 30_000) * 30_000;

// 0 renders the placeholder; hydration swaps in the real value.
const serverNow = () => 0;

export function Uptime({ startedAt }: { startedAt: number | null }) {
  const now = useSyncExternalStore(subscribe, clientNow, serverNow);

  if (!startedAt || !now) return <>—</>;
  return <>{duration(now - startedAt)}</>;
}
