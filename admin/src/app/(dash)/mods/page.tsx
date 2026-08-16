"use client";

import { useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { ProjectCard } from "@/components/ProjectCard";
import { SortBar, type SortKey } from "@/components/SortBar";
import { usePolled } from "@/lib/polling";
import { bytes, relativeTime } from "@/lib/format";
import type { ModpackResponse, ModsResponse } from "@/lib/api";
import type { ModFile } from "@/lib/files";
import type { ModProject } from "@/lib/modrinth";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Pairs each declared mod with the jar it resolved to.
function pair(projects: ModProject[], jars: ModFile[]) {
  const byLength = [...projects].sort((a, b) => b.slug.length - a.slug.length);
  const taken = new Map<string, ModFile>();
  const spare: ModFile[] = [];

  for (const jar of jars) {
    const key = squash(jar.name);
    const hit = byLength.find(
      (p) => !taken.has(p.slug) && (key.startsWith(squash(p.slug)) || key.startsWith(squash(p.title))),
    );
    if (hit) taken.set(hit.slug, jar);
    else spare.push(jar);
  }
  return {
    rows: projects.map((p) => ({ ...p, jar: taken.get(p.slug) ?? null })),
    spare,
  };
}

export default function ModsPage() {
  const { data: modsData } = usePolled<ModsResponse>("/api/mods");
  const { data: pack } = usePolled<ModpackResponse>("/api/modpack");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [showSpare, setShowSpare] = useState(false);

  const projects = useMemo(() => modsData?.projects ?? [], [modsData]);
  const jars = useMemo(() => modsData?.mods ?? [], [modsData]);

  const { rows, spare } = useMemo(() => pair(projects, jars), [projects, jars]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rows.filter(
          (r) => r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q),
        )
      : rows;
    return [...matched].sort((a, b) =>
      sort === "downloads"
        ? b.downloads - a.downloads
        : sort === "size"
          ? (b.jar?.bytes ?? 0) - (a.jar?.bytes ?? 0)
          : a.title.localeCompare(b.title),
    );
  }, [rows, query, sort]);

  const total = jars.reduce((sum, m) => sum + m.bytes, 0);

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Player modpack"
          hint="The same jars the server runs, minus the server-only tools, plus the client-side ones"
          accent="var(--series-players)"
        />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          {pack?.available ? (
            <>
              <a
                href="/api/modpack?download=1"
                className="rounded-xl border border-(--glass-border) bg-(--glass-fill) px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95"
              >
                ⬇ Download modpack.zip
              </a>
              <span className="text-xs text-ink-muted">
                {bytes(pack.bytes)} · built {relativeTime(pack.modified)}
              </span>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              {pack?.hint ?? "Not built yet."} Run{" "}
              <code className="font-mono text-xs">make modpack</code> on the host.
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader
          title="Mods"
          hint="Declared in server/mods.txt and client-mods.txt, resolved on every start"
          accent="var(--series-tps)"
          right={
            projects.length > 0 && (
              <span className="rounded-full border border-(--glass-border) px-2.5 py-0.5 text-xs tabular-nums text-ink-secondary">
                {projects.length} · {bytes(total)}
              </span>
            )
          }
        />

        <div className="flex flex-col gap-3 px-5 pb-3 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter mods…"
            aria-label="Filter mods"
            className="w-full rounded-xl border border-(--glass-border) bg-(--glass-inset) px-3 py-2 text-sm placeholder:text-ink-muted sm:max-w-xs"
          />
          <SortBar value={sort} onChange={setSort} keys={["name", "downloads", "size"]} />
        </div>

        {modsData === null && (
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        )}

        {modsData !== null && projects.length === 0 && (
          <p className="px-5 pb-5 text-sm text-ink-muted">
            Modrinth is unreachable, or the lists are not mounted into the panel.
          </p>
        )}

        {shown.length > 0 && (
          <ul className="grid gap-3 px-5 pb-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((r) => (
              <ProjectCard
                key={r.slug}
                title={r.title}
                description={r.description}
                iconUrl={r.iconUrl}
                href={r.pageUrl}
                badge={
                  <span
                    title={r.client ? "Client-side only" : "Installed on the server"}
                    className="mt-0.5 size-2 shrink-0 rounded-full"
                    style={{
                      background: r.client ? "var(--series-cpu)" : "var(--series-players)",
                    }}
                  />
                }
                footer={
                  <>
                    <span className="truncate font-mono text-[10px]">
                      {r.jar?.name ?? (r.client ? "shipped in the pack" : r.slug)}
                    </span>
                    {r.jar && (
                      <span className="shrink-0 tabular-nums">{bytes(r.jar.bytes)}</span>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        )}

        {spare.length > 0 && (
          <div className="px-5 pb-5">
            <button
              onClick={() => setShowSpare((v) => !v)}
              className="text-xs text-ink-muted hover:text-ink"
            >
              {showSpare ? "▾" : "▸"} {spare.length} more jars on the server
              {" · "}
              {bytes(spare.reduce((s, j) => s + j.bytes, 0))}
            </button>
            {showSpare && (
              <>
                <p className="mt-2 text-[11px] text-ink-muted">
                  Dependencies pulled in automatically, plus any mod whose jar is
                  named after its mod id rather than its Modrinth slug.
                </p>
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {spare.map((j) => (
                  <li
                    key={j.name}
                    className="flex items-center justify-between gap-3 text-[11px] text-ink-muted"
                  >
                    <span className="truncate font-mono">{j.name}</span>
                    <span className="shrink-0 tabular-nums">{bytes(j.bytes)}</span>
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard delay={2}>
        <CardHeader title="Changing the mod list" />
        <div className="space-y-3 px-5 pb-5 text-sm text-ink-secondary">
          <p>
            The list is declarative. Edit{" "}
            <code className="font-mono text-xs">server/mods.txt</code> for the server
            or <code className="font-mono text-xs">server/client-mods.txt</code> for
            mods that only players need, one Modrinth slug per line, then restart.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-(--glass-inset) p-3 font-mono text-xs">
{`nano server/mods.txt
make restart
make modpack`}
          </pre>
          <p className="text-ink-muted">
            Editing files here would put the panel and the repository out of sync, so
            it is intentionally read-only.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
