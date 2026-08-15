"use client";

import { GlassCard, CardHeader } from "@/components/GlassCard";
import { usePolled } from "@/lib/polling";
import { bytes, relativeTime } from "@/lib/format";
import type { BackupsResponse } from "@/lib/api";

export default function BackupsPage() {
  const { data } = usePolled<BackupsResponse>("/api/backups", 60_000);
  const backups = data?.backups ?? null;
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
              <span className="rounded-full border border-(--glass-border) px-2.5 py-0.5 text-xs tabular-nums text-ink-secondary">
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
            <p className="px-2 py-4 text-sm text-ink-muted">
              No archives yet. Backups run nightly at midnight, on the schedule in{" "}
              <code className="font-mono">BACKUP_CRON</code>, and the three most
              recent are kept.
            </p>
          )}

          <ul className="space-y-1">
            {backups?.map((b) => (
              <li
                key={b.name}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-(--glass-inset)"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs">{b.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    {new Date(b.modified).toLocaleString()} · {relativeTime(b.modified)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-ink-secondary">
                  {bytes(b.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader title="Restoring" />
        <div className="space-y-3 px-5 pb-5 text-sm text-ink-secondary">
          <p>
            Restoring replaces the live world, so it is deliberately a shell
            operation rather than a button here:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-(--glass-inset) p-3 font-mono text-xs">
{`make backups
make restore F=server/backups/<archive>.tar.gz`}
          </pre>
          <p>
            It asks for confirmation, stops the server, moves the current world
            aside rather than deleting it, then starts back up.
          </p>
          <p className="text-ink-muted">
            These archives sit on the same disk as the server. That covers a
            corrupted world or a bad mod update — not losing the host. Sync them
            off-site as well.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
