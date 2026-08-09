"use client";

import { useEffect, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { bytes, relativeTime } from "@/components/format";

type Backup = { name: string; bytes: number; modified: number };

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/backups", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setBackups(d.backups ?? []))
        .catch(() => setBackups([]));
    void load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  const total = backups?.reduce((sum, b) => sum + b.bytes, 0) ?? 0;

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="World archives"
          hint="Written by the backup sidecar with the world saved and flushed"
          accent="var(--series-tps)"
          right={
            backups && (
              <span className="rounded-full border border-[var(--glass-border)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--ink-secondary)]">
                {backups.length} · {bytes(total)}
              </span>
            )
          }
        />

        <div className="px-3 pb-4">
          {backups === null &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton mx-2 mb-1 h-11 rounded-xl" />
            ))}

          {backups?.length === 0 && (
            <p className="px-2 py-4 text-sm text-[var(--ink-muted)]">
              No archives yet. The first one runs 5 minutes after start, then
              every 6 hours — and is skipped entirely when nobody has been
              online since the last one.
            </p>
          )}

          <ul className="space-y-1">
            {backups?.map((b) => (
              <li
                key={b.name}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--glass-fill-2)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs">{b.name}</span>
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    {new Date(b.modified).toLocaleString()} · {relativeTime(b.modified)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-[var(--ink-secondary)]">
                  {bytes(b.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader title="Restoring" />
        <div className="space-y-3 px-5 pb-5 text-sm text-[var(--ink-secondary)]">
          <p>
            Restoring replaces the live world, so it is deliberately a shell
            operation rather than a button here:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[var(--glass-fill-2)] p-3 font-mono text-xs">
{`make backups
make restore F=server/backups/<archive>.tar.gz`}
          </pre>
          <p>
            It asks for confirmation, stops the server, moves the current world
            aside rather than deleting it, then starts back up.
          </p>
          <p className="text-[var(--ink-muted)]">
            These archives sit on the same disk as the server. That covers a
            corrupted world or a bad mod update — not losing the host. Sync them
            off-site as well.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
