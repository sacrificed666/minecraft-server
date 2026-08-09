"use client";

import { useEffect, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";

export default function MapPage() {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/server")
      .then((r) => r.json())
      .then((d) => setMapUrl(d.mapUrl || null))
      .catch(() => setMapUrl(null));
  }, []);

  if (mapUrl === null) {
    return (
      <GlassCard>
        <CardHeader title="Map" />
        <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">
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
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--glass-border)] px-3 py-1.5 text-xs font-medium transition-transform hover:scale-105"
            >
              Open full screen ↗
            </a>
          }
        />
        <div className="relative mx-3 mb-3 h-[70vh] overflow-hidden rounded-xl bg-[var(--glass-fill-2)]">
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--ink-muted)]">
              Loading the map…
            </div>
          )}
          <iframe
            src={mapUrl}
            title="BlueMap"
            className="size-full border-0"
            onLoad={() => setReady(true)}
            // The map is a separate origin behind the same proxy; it needs no
            // access to this page, so keep the sandbox tight.
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader title="About the render" />
        <div className="space-y-2 px-5 pb-5 text-sm text-[var(--ink-secondary)]">
          <p>
            BlueMap renders in the background and keeps up with changes as
            players explore. The first full render of an existing world takes a
            while and competes with the server tick, which is why it is capped
            at two threads in{" "}
            <code className="font-mono text-xs">server/bluemap/core.conf</code>.
          </p>
          <p className="text-[var(--ink-muted)]">
            Its output is excluded from backups — it is large and fully
            regenerable from the world itself.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
