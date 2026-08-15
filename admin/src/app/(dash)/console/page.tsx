"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { ConsolePanel } from "./ConsolePanel";
import { usePolled } from "@/lib/polling";
import type { LogsResponse } from "@/lib/api";

export default function ConsolePage() {
  const { data } = usePolled<LogsResponse>("/api/logs", 5000);
  const [follow, setFollow] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const lines = data?.lines ?? null;

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
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                className="accent-(--series-tps)"
              />
              Follow
            </label>
          }
        />
        <div
          ref={logRef}
          className="mx-3 mb-3 h-104 overflow-auto rounded-xl bg-(--glass-inset) p-3 font-mono text-[11px] leading-relaxed"
          role="log"
        >
          {lines === null && <p className="text-ink-muted">Loading…</p>}
          {lines?.length === 0 && (
            <p className="text-ink-muted">
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
