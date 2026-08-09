"use client";

import { useEffect, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { LineChart, type Point } from "@/components/LineChart";
import { Meter, StatTile } from "@/components/StatTile";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useMetrics, POLL_MS } from "@/components/MetricsProvider";
import { bytes } from "@/components/format";
import { Uptime } from "@/components/Uptime";
import { QuickActions } from "@/components/QuickActions";

type ServerInfo = {
  properties: Record<string, string>;
  worldBytes: number | null;
  ops: { uuid: string; name: string }[];
  startedAt: number | null;
  serverHost: string;
};

export default function OverviewPage() {
  const { snap } = useMetrics();
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/server")
        .then((r) => r.json())
        .then(setInfo)
        .catch(() => {});
    void load();
    // World size and uptime move slowly; no need to poll them at chart speed
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  const history = snap?.history ?? [];
  const tps: Point[] = history.map((s) => ({ t: s.t, v: s.tps }));
  const players: Point[] = history.map((s) => ({ t: s.t, v: s.players }));
  const cpu: Point[] = history.map((s) => ({ t: s.t, v: s.cpu }));
  const hasCpu = cpu.some((p) => p.v !== null);

  return (
    <div className="space-y-4">
      {snap?.error && (
        <div
          className="glass rise border-l-2 p-4 text-sm"
          style={{ borderLeftColor: "var(--critical)" }}
          role="alert"
        >
          <strong className="font-semibold">Server unreachable.</strong>{" "}
          <span className="text-[var(--ink-secondary)]">{snap.error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Players"
          value={String(snap?.players.online ?? 0)}
          suffix={`/ ${snap?.players.max ?? 0}`}
          accent="var(--series-players)"
          detail={snap?.players.names.slice(0, 3).join(", ") || "Nobody online"}
          delay={0}
        />
        <StatTile
          label="TPS"
          value={snap?.overallTps != null ? snap.overallTps.toFixed(2) : "—"}
          suffix="/ 20"
          accent="var(--series-tps)"
          detail={
            snap?.overallTps == null
              ? "Waiting for the server"
              : snap.overallTps < 19
                ? "Below target"
                : "Healthy"
          }
          delay={1}
        />
        {hasCpu ? (
          <StatTile
            label="CPU"
            value={snap?.cpuPercent != null ? snap.cpuPercent.toFixed(0) : "—"}
            suffix="%"
            accent="var(--series-cpu)"
            detail="Percent of one core"
            delay={2}
          />
        ) : (
          <StatTile label="CPU" value="—" detail="Docker socket not mounted" delay={2} />
        )}
        {snap?.memoryBytes != null && snap.memoryLimitBytes ? (
          <Meter
            label="Memory"
            used={snap.memoryBytes}
            limit={snap.memoryLimitBytes}
            format={bytes}
            delay={3}
          />
        ) : (
          <StatTile label="Memory" value="—" detail="Docker socket not mounted" delay={3} />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard delay={4}>
          <CardHeader
            title="Ticks per second"
            hint="20 is full speed; sustained dips mean the tick is overloaded"
            accent="var(--series-tps)"
          />
          <LineChart data={tps} color="var(--series-tps)" domain={[0, 20]} format={(v) => v.toFixed(0)} />
        </GlassCard>

        <GlassCard delay={5}>
          <CardHeader
            title="Players online"
            hint={`Last 30 minutes, sampled every ${POLL_MS / 1000}s`}
            accent="var(--series-players)"
          />
          <LineChart
            data={players}
            color="var(--series-players)"
            domain={[0, Math.max(snap?.players.max ?? 10, 1)]}
            format={(v) => v.toFixed(0)}
          />
        </GlassCard>
      </div>

      {hasCpu && (
        <GlassCard delay={6}>
          <CardHeader
            title="CPU usage"
            hint="Percent of one core; the main tick is single-threaded"
            accent="var(--series-cpu)"
          />
          <LineChart data={cpu} color="var(--series-cpu)" format={(v) => `${v.toFixed(0)}%`} />
        </GlassCard>
      )}

      <QuickActions delay={7} />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard delay={8}>
          <CardHeader title="Online now" accent="var(--series-players)" />
          <div className="px-5 pb-5">
            {snap?.players.names.length ? (
              <ul className="flex flex-wrap gap-2">
                {snap.players.names.map((n) => (
                  <li
                    key={n}
                    className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] px-2.5 py-1.5 text-sm"
                  >
                    <PlayerAvatar seed={n} size={20} />
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">Nobody is online.</p>
            )}
          </div>
        </GlassCard>

        <GlassCard delay={9}>
          <CardHeader title="Server" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 pb-5 text-sm">
            <div className="contents">
              <dt className="text-[var(--ink-muted)]">Uptime</dt>
              <dd className="truncate text-right font-medium tabular-nums">
                <Uptime startedAt={info?.startedAt ?? null} />
              </dd>
            </div>
            <Row label="Address" value={info?.serverHost || "—"} />
            <Row label="World size" value={info?.worldBytes != null ? bytes(info.worldBytes) : "—"} />
            <Row label="World" value={info?.properties.levelName || "—"} />
            <Row label="Seed" value={info?.properties.levelSeed || "random"} />
            <Row label="Difficulty" value={info?.properties.difficulty || "—"} />
            <Row label="View distance" value={info?.properties.viewDistance || "—"} />
          </dl>
        </GlassCard>
      </div>

      {snap && snap.perDimensionTps.length > 0 && (
        <GlassCard delay={10}>
          <CardHeader title="Tick rate by dimension" hint="Where the tick budget goes" />
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--ink-muted)] uppercase">
                  <th className="py-2 font-medium">Dimension</th>
                  <th className="py-2 text-right font-medium">TPS</th>
                  <th className="py-2 text-right font-medium">ms / tick</th>
                </tr>
              </thead>
              <tbody>
                {snap.perDimensionTps.map((d) => (
                  <tr key={d.dimension} className="border-t border-[var(--glass-border)]">
                    <td className="py-2">{d.dimension}</td>
                    <td className="py-2 text-right tabular-nums">{d.tps.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--ink-secondary)]">
                      {d.msPerTick.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--ink-muted)]">{label}</dt>
      <dd className="truncate text-right font-medium tabular-nums">{value}</dd>
    </>
  );
}
