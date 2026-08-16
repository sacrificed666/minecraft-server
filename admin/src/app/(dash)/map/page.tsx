"use client";

import { useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { usePolled } from "@/lib/polling";
import type { ServerResponse } from "@/lib/api";

export default function MapPage() {
  const { data: info } = usePolled<ServerResponse>("/api/server");
  const [ready, setReady] = useState(false);

  // MAP_URL only resolves from the internet, so loopback gets the direct port.
  const mapUrl = useMemo(() => {
    if (!info) return null;                       // server render: no iframe yet
    const host = window.location.hostname;
    const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    return loopback ? `http://${host}:${info.mapPort}` : info.mapUrl || null;
  }, [info]);

  if (info && mapUrl === null) {
    return (
      <GlassCard>
        <CardHeader title="Map" />
        <p className="px-5 pb-5 text-sm text-ink-muted">
          No map URL configured. Set <code className="font-mono">MAP_HOST</code>{" "}
          in <code className="font-mono">.env</code> and restart the panel.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="overflow-hidden">
        <CardHeader
          title="Live world map"
          hint="Rendered by BlueMap from the actual world data"
          accent="var(--series-players)"
          right={
            mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-(--glass-border) px-3 py-1.5 text-xs font-medium transition-transform hover:scale-105"
              >
                Open full screen ↗
              </a>
            )
          }
        />
        <div className="relative mx-3 mb-3 h-[70vh] overflow-hidden rounded-xl bg-(--glass-inset)">
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-muted">
              Loading the map…
            </div>
          )}
          {mapUrl && (
            <iframe
              src={mapUrl}
              title="BlueMap"
              className="size-full border-0"
              onLoad={() => setReady(true)}
              // Separate origin, so the sandbox stays tight.
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader title="About the render" />
        <div className="space-y-2 px-5 pb-5 text-sm text-ink-secondary">
          <p>
            BlueMap renders in the background and keeps up with changes as
            players explore. The first full render of an existing world takes a
            while and competes with the server tick, which is why it is capped
            at two threads in{" "}
            <code className="font-mono text-xs">server/bluemap/core.conf</code>.
          </p>
          <p className="text-ink-muted">
            Its output is excluded from backups — it is large and fully
            regenerable from the world itself.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
