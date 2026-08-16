"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Polled<T> = {
  data: T | null;
  // The last attempt failed; `data` is the previous good value.
  stale: boolean;
  updatedAt: number | null;
};

// Fetches JSON once, then on an interval when one is given.
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
        // Marked, not blanked — a stale reading beats an empty one.
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
