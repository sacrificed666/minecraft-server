"use client";

import { useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { ProjectCard } from "@/components/ProjectCard";
import { SortBar, type SortKey } from "@/components/SortBar";
import { usePolled } from "@/lib/polling";
import { bytes } from "@/lib/format";
import type { ExtrasResponse } from "@/lib/api";
import type { Extra } from "@/lib/modrinth";

const KINDS = [
  { key: "shader" as const, title: "Shaders", hint: "Need Iris, which the modpack already ships. Drop into .minecraft/shaderpacks" },
  { key: "resourcepack" as const, title: "Resource packs", hint: "Drop into .minecraft/resourcepacks, then enable in Options → Resource Packs" },
];

export default function LooksPage() {
  const { data, stale } = usePolled<ExtrasResponse>("/api/extras", 300_000);
  const [sort, setSort] = useState<SortKey>("downloads");
  const [query, setQuery] = useState("");

  const extras = useMemo(() => data?.extras ?? [], [data]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? extras.filter(
          (e) =>
            e.title.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q),
        )
      : extras;
    const sorted = [...matched];
    sorted.sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "size"
          ? (b.fileBytes ?? 0) - (a.fileBytes ?? 0)
          : b.downloads - a.downloads,
    );
    return sorted;
  }, [extras, query, sort]);

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Looks"
          hint="Shaders and resource packs, resolved from Modrinth for this server's Minecraft version"
          accent="var(--series-cpu)"
          right={
            extras.length > 0 && (
              <span className="rounded-full border border-(--glass-border) px-2.5 py-0.5 text-xs tabular-nums text-ink-secondary">
                {extras.length}
              </span>
            )
          }
        />
        <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter shaders and resource packs"
            className="w-full rounded-xl border border-(--glass-border) bg-(--glass-inset) px-3 py-2 text-sm placeholder:text-ink-muted sm:max-w-xs"
          />
          <SortBar value={sort} onChange={setSort} />
        </div>
      </GlassCard>

      {data === null && (
        <GlassCard delay={1}>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        </GlassCard>
      )}

      {data !== null && extras.length === 0 && (
        <GlassCard delay={1}>
          <CardHeader title="Nothing to show" />
          <p className="px-5 pb-5 text-sm text-ink-muted">
            {stale
              ? "Modrinth is unreachable from the server right now."
              : "server/shaders.txt and server/resourcepacks.txt are empty or not mounted."}
          </p>
        </GlassCard>
      )}

      {KINDS.map((kind, i) => {
        const items = shown.filter((e) => e.kind === kind.key);
        if (!items.length) return null;
        return (
          <GlassCard key={kind.key} delay={i + 1}>
            <CardHeader
              title={kind.title}
              hint={kind.hint}
              accent={kind.key === "shader" ? "var(--series-tps)" : "var(--series-players)"}
              right={
                <span className="rounded-full border border-(--glass-border) px-2.5 py-0.5 text-xs tabular-nums text-ink-secondary">
                  {items.length}
                </span>
              }
            />
            <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((e) => (
                <ExtraCard key={e.slug} extra={e} />
              ))}
            </ul>
          </GlassCard>
        );
      })}
    </div>
  );
}

function ExtraCard({ extra }: { extra: Extra }) {
  return (
    <ProjectCard
      title={extra.title}
      description={extra.description}
      iconUrl={extra.iconUrl}
      href={extra.pageUrl}
      footer={
        <>
          <span className="truncate tabular-nums">
            {extra.version ?? "no build"}
            {extra.fileBytes ? ` · ${bytes(extra.fileBytes)}` : ""}
          </span>
          {extra.fileUrl ? (
            <a
              href={extra.fileUrl}
              className="shrink-0 rounded-lg border border-(--glass-border) bg-(--glass-fill) px-2.5 py-1 font-medium text-ink transition-transform hover:scale-105 active:scale-95"
            >
              ⬇ Download
            </a>
          ) : (
            <span className="shrink-0">unavailable</span>
          )}
        </>
      }
    />
  );
}
