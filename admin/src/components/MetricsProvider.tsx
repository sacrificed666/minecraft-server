"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type Sample = {
  t: number;
  players: number | null;
  tps: number | null;
  cpu: number | null;
};

export type Snapshot = {
  online: boolean;
  players: { online: number; max: number; names: string[] };
  overallTps: number | null;
  perDimensionTps: { dimension: string; tps: number; msPerTick: number }[];
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
  cpuPercent: number | null;
  history: Sample[];
  error?: string;
};

export const POLL_MS = 5000;

/**
 * One poller for the whole app. Every page reads the same snapshot, so
 * navigating between sections never restarts the charts or doubles the RCON
 * traffic against the server.
 */
const MetricsContext = createContext<{
  snap: Snapshot | null;
  stale: boolean;
  updatedAt: number | null;
}>({ snap: null, stale: false, updatedAt: null });

export const useMetrics = () => useContext(MetricsContext);

export function MetricsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (alive) {
          setSnap(data);
          setStale(false);
          setUpdatedAt(Date.now());
        }
      } catch {
        // Keep the last good snapshot but mark it, rather than blanking the UI
        if (alive) setStale(true);
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [router]);

  return (
    <MetricsContext.Provider value={{ snap, stale, updatedAt }}>
      {children}
    </MetricsContext.Provider>
  );
}
