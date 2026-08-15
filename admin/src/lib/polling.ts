"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Polled<T> = {
  data: T | null;
  /** The last attempt failed; `data` is the previous good value. */
  stale: boolean;
  updatedAt: number | null;
};

/**
 * Fetches JSON once, then on an interval when one is given.
 *
 * Every page wanted the same four things — no caching, cleanup on unmount, the
 * last good value kept when a request fails, and a session that expired sending
 * the browser back to the login page — and each hand-rolled effect got a
 * different subset of them right.
 */
export function usePolled<T>(url: string, intervalMs?: number): Polled<T> {
  const router = useRouter();
  const [state, setState] = useState<Polled<T>>({
    data: null,
    stale: false,
    updatedAt: null,
  });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as T;
        if (alive) setState({ data, stale: false, updatedAt: Date.now() });
      } catch {
        // Mark it rather than blanking the page — the old reading is still
        // more useful than an empty one.
        if (alive) setState((prev) => ({ ...prev, stale: true }));
      }
    };

    void load();
    if (!intervalMs) {
      return () => {
        alive = false;
      };
    }

    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [url, intervalMs, router]);

  return state;
}
