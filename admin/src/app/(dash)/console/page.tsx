"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { ConsolePanel } from "@/components/ConsolePanel";

export default function ConsolePage() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [follow, setFollow] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/logs", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        setLines(data.lines ?? []);
      } catch {
        /* keep the previous lines */
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (follow && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, follow]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ConsolePanel delay={0} />

      <GlassCard delay={1} className="flex flex-col">
        <CardHeader
          title="Server log"
          hint="latest.log, refreshed every 5s"
          right={
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                className="accent-[var(--series-tps)]"
              />
              Follow
            </label>
          }
        />
        <div
          ref={logRef}
          className="mx-3 mb-3 h-[26rem] overflow-auto rounded-xl bg-[var(--glass-fill-2)] p-3 font-mono text-[11px] leading-relaxed"
          role="log"
        >
          {lines === null && <p className="text-[var(--ink-muted)]">Loading…</p>}
          {lines?.length === 0 && (
            <p className="text-[var(--ink-muted)]">
              No log yet — the server may still be starting.
            </p>
          )}
          {lines?.map((line, i) => (
            <div
              key={i}
              className="whitespace-pre-wrap"
              style={{
                color: /ERROR|FATAL/.test(line)
                  ? "var(--critical)"
                  : /WARN/.test(line)
                    ? "var(--warning)"
                    : "var(--ink-secondary)",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
