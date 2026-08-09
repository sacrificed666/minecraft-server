"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/SessionProvider";
import { useMetrics } from "@/components/MetricsProvider";
import { relativeTime } from "@/components/format";

type Account = {
  id: number;
  username: string;
  role: "admin" | "player";
  createdAt: string;
  lastLogin: string | null;
};
type Entry = { uuid: string; name: string };

/**
 * One person, assembled from three sources that used to have their own pages:
 * the whitelist file, the accounts table, and who is connected right now.
 * Keeping them apart made the admin do the join in their head.
 */
type Person = {
  name: string;
  account: Account | null;
  whitelisted: boolean;
  op: boolean;
  online: boolean;
};

const key = (name: string) => name.toLowerCase();

export default function PlayersPage() {
  const me = useSession();
  const toast = useToast();
  const { snap } = useMetrics();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [whitelist, setWhitelist] = useState<Entry[] | null>(null);
  const [ops, setOps] = useState<Entry[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Generated passwords are shown once and stored only as a hash
  const [reveal, setReveal] = useState<{ username: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    const [u, w, s] = await Promise.allSettled([
      fetch("/api/users", { cache: "no-store" }).then(async (r) => ({
        ok: r.ok,
        data: await r.json(),
      })),
      fetch("/api/whitelist", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/server", { cache: "no-store" }).then((r) => r.json()),
    ]);
    if (u.status === "fulfilled") {
      if (u.value.ok) {
        setAccounts(u.value.data.users ?? []);
        setDbError(null);
      } else {
        setAccounts([]);
        setDbError(u.value.data.error ?? "User database unavailable");
      }
    }
    if (w.status === "fulfilled") setWhitelist(w.value.players ?? []);
    if (s.status === "fulfilled") setOps(s.value.ops ?? []);
  }, []);

  useEffect(() => {
    // Wrapped so the state updates land in a microtask rather than
    // synchronously inside the effect body.
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const online = useMemo(
    () => new Set((snap?.players.names ?? []).map(key)),
    [snap?.players.names],
  );

  const people = useMemo<Person[]>(() => {
    const byName = new Map<string, Person>();
    const touch = (n: string): Person => {
      const k = key(n);
      let p = byName.get(k);
      if (!p) {
        p = { name: n, account: null, whitelisted: false, op: false, online: online.has(k) };
        byName.set(k, p);
      }
      return p;
    };
    for (const entry of whitelist ?? []) touch(entry.name).whitelisted = true;
    for (const account of accounts ?? []) touch(account.username).account = account;
    for (const op of ops) touch(op.name).op = true;
    for (const n of snap?.players.names ?? []) touch(n);
    return [...byName.values()].sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        Number(b.op) - Number(a.op) ||
        a.name.localeCompare(b.name),
    );
  }, [whitelist, accounts, ops, online, snap?.players.names]);

  if (me && me.role !== "admin") {
    return (
      <GlassCard>
        <CardHeader title="Players" />
        <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">
          Only administrators can manage players.
        </p>
      </GlassCard>
    );
  }

  async function addPlayer(withAccount: boolean) {
    const username = name.trim();
    if (!username) return;
    setBusy(true);
    try {
      if (withAccount) {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast("error", data.error ?? "Could not create the account");
          return;
        }
        setReveal({ username, password: data.password });
        toast(
          data.whitelisted ? "ok" : "error",
          data.whitelisted
            ? `${username} can sign in and join`
            : `Account made, but whitelisting failed: ${data.whitelistMessage}`,
        );
      } else {
        const res = await fetch("/api/whitelist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: username }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast("error", data.error ?? "Could not whitelist");
          return;
        }
        toast("ok", data.message?.trim() || `${username} whitelisted`);
      }
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(person: Person) {
    if (!person.account) return;
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: person.account.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", data.error ?? "Could not reset the password");
      return;
    }
    setReveal({ username: person.name, password: data.password });
    toast("ok", `New password for ${person.name}`);
  }

  async function grantAccount(person: Person) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: person.name }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", data.error ?? "Could not create the account");
      return;
    }
    setReveal({ username: person.name, password: data.password });
    toast("ok", `${person.name} can now sign in`);
    await refresh();
  }

  async function removePerson(person: Person) {
    const what = person.account
      ? `Remove ${person.name}? This deletes their panel account and takes them off the whitelist.`
      : `Take ${person.name} off the whitelist?`;
    if (!confirm(what)) return;

    if (person.account) {
      await fetch("/api/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: person.account.id, unwhitelist: true }),
      });
    } else {
      await fetch("/api/whitelist", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: person.name }),
      });
    }
    toast("ok", `${person.name} removed`);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {reveal && (
        <GlassCard delay={0}>
          <CardHeader
            title={`Password for ${reveal.username}`}
            hint="Shown once — copy it now, only a hash is stored"
            accent="var(--warning)"
            right={
              <button
                onClick={() => setReveal(null)}
                className="rounded-lg px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              >
                Dismiss
              </button>
            }
          />
          <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
            <code className="rounded-xl bg-[var(--glass-fill-2)] px-4 py-2.5 font-mono text-lg tracking-wider select-all">
              {reveal.password}
            </code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(reveal.password);
                toast("ok", "Copied");
              }}
              className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-sm transition-transform hover:scale-105 active:scale-95"
            >
              Copy
            </button>
          </div>
        </GlassCard>
      )}

      <GlassCard delay={1}>
        <CardHeader
          title="Add a player"
          hint="An account also whitelists them; whitelist-only skips the panel login"
          accent="var(--series-players)"
        />
        <form
          className="flex flex-wrap gap-2 px-5 pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            void addPlayer(true);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Minecraft username"
            aria-label="Minecraft username"
            maxLength={16}
            className="min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-2)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
          >
            {busy ? "…" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => void addPlayer(false)}
            disabled={busy || !name.trim()}
            className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm text-[var(--ink-secondary)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
          >
            Whitelist only
          </button>
        </form>
      </GlassCard>

      <GlassCard delay={2}>
        <CardHeader
          title="People"
          hint="Whitelist, panel accounts and who is connected, in one list"
          right={
            <span className="rounded-full border border-[var(--glass-border)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--ink-secondary)]">
              {people.length}
            </span>
          }
        />

        {dbError && (
          <p className="px-5 pb-3 text-xs" style={{ color: "var(--critical)" }}>
            Accounts unavailable: {dbError}. Whitelist entries are still shown.
          </p>
        )}

        <div className="px-3 pb-4">
          {whitelist === null &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton mx-2 mb-1 h-12 rounded-xl" />
            ))}

          {whitelist !== null && people.length === 0 && (
            <p className="px-2 py-4 text-sm text-[var(--ink-muted)]">
              Nobody yet. Add the first player above.
            </p>
          )}

          <ul className="space-y-1">
            {people.map((p) => (
              <li
                key={key(p.name)}
                className="group flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--glass-fill-2)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar seed={p.name} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {p.name}
                      {p.online && (
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: "var(--good)" }}
                          title="Online"
                        />
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                      <Badge on={p.whitelisted} label="whitelisted" />
                      <Badge on={!!p.account} label="account" />
                      <Badge on={p.op} label="operator" />
                      {p.account?.lastLogin && (
                        <span>· signed in {relativeTime(Date.parse(p.account.lastLogin))}</span>
                      )}
                    </span>
                  </span>
                </span>

                <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {p.account ? (
                    <button
                      onClick={() => void resetPassword(p)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                    >
                      Reset password
                    </button>
                  ) : (
                    <button
                      onClick={() => void grantAccount(p)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                    >
                      Give account
                    </button>
                  )}
                  <button
                    onClick={() => void removePerson(p)}
                    className="rounded-lg px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--critical)]"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="px-5 pb-4 text-xs text-[var(--ink-muted)]">
          Operators are granted from the shell —{" "}
          <code className="font-mono">make cmd C=&quot;op Nick&quot;</code> — so handing
          out server-wide power never happens by a stray click here.
        </p>
      </GlassCard>
    </div>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  if (!on) return null;
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] tracking-wide uppercase"
      style={{ background: "var(--glass-fill)", color: "var(--ink-secondary)" }}
    >
      {label}
    </span>
  );
}
