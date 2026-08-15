"use client";

import { GlassCard, CardHeader } from "@/components/GlassCard";
import { Uptime } from "@/components/Uptime";
import { useMetrics } from "@/components/providers/MetricsProvider";
import { usePolled } from "@/lib/polling";
import { bytes } from "@/lib/format";
import type { ServerResponse, ServerSettings } from "@/lib/api";

// Keyed by ServerSettings, so a field renamed on the server fails to compile
const GROUPS: { title: string; keys: [keyof ServerSettings, string][] }[] = [
  {
    title: "World",
    keys: [
      ["levelName", "Level name"],
      ["levelSeed", "Seed"],
      ["difficulty", "Difficulty"],
      ["gamemode", "Game mode"],
      ["hardcore", "Hardcore"],
    ],
  },
  {
    title: "Performance",
    keys: [
      ["viewDistance", "View distance"],
      ["simulationDistance", "Simulation distance"],
      ["maxPlayers", "Max players"],
    ],
  },
  {
    title: "Access",
    keys: [
      ["onlineMode", "Online mode"],
      ["whitelist", "Whitelist enforced"],
      ["pvp", "PvP"],
      ["allowFlight", "Allow flight"],
    ],
  },
];

export default function SettingsPage() {
  const { data: snap } = useMetrics();
  const { data: info } = usePolled<ServerResponse>("/api/server");

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Server settings"
          hint="Read from server.properties — edit .env and restart to change them"
        />
        <div className="grid gap-6 px-5 pb-5 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {group.title}
              </h3>
              <dl className="space-y-1.5 text-sm">
                {group.keys.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="truncate font-medium">
                      {info?.properties[key] || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard delay={1}>
          <CardHeader title="MOTD" hint="What players see in the server list" />
          <p className="px-5 pb-5 font-mono text-sm">
            {info?.properties.motd || "—"}
          </p>
        </GlassCard>

        <GlassCard delay={2}>
          <CardHeader title="Runtime" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-5 text-sm">
            <dt className="text-ink-muted">Uptime</dt>
            <dd className="text-right font-medium tabular-nums">
              <Uptime startedAt={info?.startedAt ?? null} />
            </dd>
            <dt className="text-ink-muted">World size</dt>
            <dd className="text-right font-medium tabular-nums">
              {info?.worldBytes != null ? bytes(info.worldBytes) : "—"}
            </dd>
            <dt className="text-ink-muted">Memory limit</dt>
            <dd className="text-right font-medium tabular-nums">
              {snap?.memoryLimitBytes ? bytes(snap.memoryLimitBytes) : "—"}
            </dd>
          </dl>
        </GlassCard>
      </div>

      <GlassCard delay={3}>
        <CardHeader title="Why nothing here is editable" />
        <div className="space-y-3 px-5 pb-5 text-sm text-ink-secondary">
          <p>
            The server re-applies these values from{" "}
            <code className="font-mono text-xs">.env</code> on every start
            (<code className="font-mono text-xs">OVERRIDE_SERVER_PROPERTIES</code>).
            A change made here would be silently reverted on the next restart,
            which is worse than no button at all.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-(--glass-inset) p-3 font-mono text-xs">
{`nano .env
make restart`}
          </pre>
        </div>
      </GlassCard>
    </div>
  );
}
