"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { bytes, relativeTime } from "@/components/format";

type Mod = { name: string; bytes: number };

/** Strips version noise so the list reads as mod names, not filenames. */
function prettyName(file: string): string {
  return file
    .replace(/\.jar$/, "")
    .replace(/[-_](neoforge|forge|fabric)?[-_]?(mc)?\d[\w.+-]*$/i, "")
    .replace(/[-_]/g, " ")
    .trim();
}

type Modpack = { available: boolean; bytes?: number; modified?: number; hint?: string };

export default function ModsPage() {
  const [mods, setMods] = useState<Mod[] | null>(null);
  const [pack, setPack] = useState<Modpack | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/mods", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMods(d.mods ?? []))
      .catch(() => setMods([]));
    fetch("/api/modpack", { cache: "no-store" })
      .then((r) => r.json())
      .then(setPack)
      .catch(() => setPack({ available: false }));
  }, []);

  const filtered = useMemo(() => {
    if (!mods) return null;
    const q = query.trim().toLowerCase();
    return q ? mods.filter((m) => m.name.toLowerCase().includes(q)) : mods;
  }, [mods, query]);

  const total = mods?.reduce((sum, m) => sum + m.bytes, 0) ?? 0;

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Player modpack"
          hint="The same jars the server runs, minus the server-only tools"
          accent="var(--series-players)"
        />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          {pack?.available ? (
            <>
              <a
                href="/api/modpack?download=1"
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95"
              >
                ⬇ Download modpack.zip
              </a>
              <span className="text-xs text-[var(--ink-muted)]">
                {bytes(pack.bytes ?? 0)}
                {pack.modified ? ` · built ${relativeTime(pack.modified)}` : ""}
              </span>
            </>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              Not built yet. Run{" "}
              <code className="font-mono text-xs">make modpack</code> on the host.
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <CardHeader
          title="Installed mods"
          hint="Resolved from server/mods.txt on every start, including jar-in-jar dependencies"
          accent="var(--series-cpu)"
          right={
            mods && (
              <span className="rounded-full border border-[var(--glass-border)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--ink-secondary)]">
                {mods.length} · {bytes(total)}
              </span>
            )
          }
        />

        <div className="px-5 pb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter mods…"
            aria-label="Filter mods"
            className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-2)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
          />
        </div>

        <div className="px-3 pb-4">
          {filtered === null &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton mx-2 mb-1 h-10 rounded-xl" />
            ))}

          {filtered?.length === 0 && (
            <p className="px-2 py-4 text-sm text-[var(--ink-muted)]">
              {mods?.length ? "No mod matches that filter." : "No mods installed yet."}
            </p>
          )}

          <ul className="grid gap-1 sm:grid-cols-2">
            {filtered?.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--glass-fill-2)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium capitalize">
                    {prettyName(m.name)}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-[var(--ink-muted)]">
                    {m.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--ink-secondary)]">
                  {bytes(m.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>

      <GlassCard delay={2}>
        <CardHeader title="Changing the mod list" />
        <div className="space-y-3 px-5 pb-5 text-sm text-[var(--ink-secondary)]">
          <p>
            The list is declarative. Edit{" "}
            <code className="font-mono text-xs">server/mods.txt</code>, one
            Modrinth slug per line, then restart — removing a line removes the
            mod.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[var(--glass-fill-2)] p-3 font-mono text-xs">
{`nano server/mods.txt
make restart`}
          </pre>
          <p className="text-[var(--ink-muted)]">
            Editing files here would put the panel and the repository out of
            sync, so it is intentionally read-only.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
