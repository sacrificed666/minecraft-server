"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePolled, type Polled } from "@/lib/polling";
import type { Snapshot } from "@/lib/history";

export const POLL_MS = 5000;

/**
 * One poller for the whole app. Every page reads the same snapshot, so
 * navigating between sections never restarts the charts or doubles the RCON
 * traffic against the server.
 */
const MetricsContext = createContext<Polled<Snapshot>>({
  data: null,
  stale: false,
  updatedAt: null,
});

export const useMetrics = () => useContext(MetricsContext);

export function MetricsProvider({ children }: { children: ReactNode }) {
  const metrics = usePolled<Snapshot>("/api/metrics", POLL_MS);
  return (
    <MetricsContext.Provider value={metrics}>{children}</MetricsContext.Provider>
  );
}
