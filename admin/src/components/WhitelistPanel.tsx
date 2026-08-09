"use client";

import { useEffect, useState, useTransition } from "react";
import { GlassCard, CardHeader } from "./GlassCard";
import { PlayerAvatar } from "./PlayerAvatar";
import { useToast } from "./Toast";

type Player = { uuid: string; name: string };

export function WhitelistPanel({ delay = 0 }: { delay?: number }) {
  const toast = useToast();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whitelist")
      .then((r) => r.json())
      .then((d) => !cancelled && setPlayers(d.players ?? []))
      .catch(() => !cancelled && setPlayers([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function mutate(method: "POST" | "DELETE", player: string) {
    const res = await fetch("/api/whitelist", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: player }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", data.error ?? "Request failed");
      return;
    }
    setPlayers(data.players ?? []);
    toast("ok", data.message?.trim() || "Done");
    if (method === "POST") setName("");
  }

  return (
    <GlassCard delay={delay} className="flex h-full flex-col">
      <CardHeader
        title="Whitelist"
        hint="Changes apply immediately and survive restarts"
        accent="var(--series-players)"
        right={
          players && (
            <span className="rounded-full border border-[var(--glass-border)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--ink-secondary)]">
              {players.length}
            </span>
          )
        }
      />

      <form
        className="flex gap-2 px-5 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) startTransition(() => void mutate("POST", name.trim()));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Username"
          aria-label="Username to add to the whitelist"
          maxLength={16}
          className="min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-2)] px-3 py-2 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {players === null &&
          Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="skeleton mx-2 h-9 rounded-xl" />
          ))}

        {players?.length === 0 && (
          <li className="px-2 py-3 text-xs text-[var(--ink-muted)]">
            Nobody whitelisted yet.
          </li>
        )}

        {players?.map((p) => (
          <li
            key={p.uuid || p.name}
            className="group flex items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-[var(--glass-fill-2)]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <PlayerAvatar seed={p.uuid || p.name} />
              <span className="truncate text-sm text-[var(--ink-primary)]">
                {p.name}
              </span>
            </span>
            <button
              onClick={() => startTransition(() => void mutate("DELETE", p.name))}
              disabled={pending}
              aria-label={`Remove ${p.name} from the whitelist`}
              className="rounded-lg px-2 py-1 text-xs text-[var(--ink-muted)] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--critical)]"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
