"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { PasswordField } from "@/components/PasswordField";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/providers/SessionProvider";
import { useMetrics } from "@/components/providers/MetricsProvider";
import { relativeTime } from "@/lib/format";
import type { PlayerEntry } from "@/lib/mc";
import type { User } from "@/lib/users";

// One person, merged from the whitelist file, the accounts table and who is online.
type Person = {
  name: string;
  account: User | null;
  whitelisted: boolean;
  op: boolean;
  online: boolean;
};

const key = (name: string) => name.toLowerCase();

export default function PlayersPage() {
  const me = useSession();
  const toast = useToast();
  const { data: snap } = useMetrics();

  const [accounts, setAccounts] = useState<User[] | null>(null);
  const [whitelist, setWhitelist] = useState<PlayerEntry[] | null>(null);
  const [ops, setOps] = useState<PlayerEntry[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Passwords are scrypt hashes, so the admin sets a new one rather than reading it.
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [chosen, setChosen] = useState("");

  // Hand-rolled: a partial failure must not blank the sources that did answer.
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
    // Wrapped so the state updates land in a microtask, not inside the effect body.
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
        <p className="px-5 pb-5 text-sm text-ink-muted">
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
        setEditing({ id: data.user.id, name: username });
        setChosen(data.password);
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

  async function setPassword(id: number, name: string, password: string) {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", data.error ?? "Could not set the password");
      return;
    }
    toast("ok", `Password saved for ${name}`);
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
    setEditing({ id: data.user.id, name: person.name });
    setChosen(data.password);
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
      {editing && (
        <GlassCard delay={0}>
          <CardHeader
            title={`Password for ${editing.name}`}
            hint="Type one, or roll a random one. The existing password is a scrypt hash and cannot be shown — only replaced."
            accent="var(--warning)"
            right={
              <button
                onClick={() => {
                  setEditing(null);
                  setChosen("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
              >
                Close
              </button>
            }
          />
          <form
            className="flex flex-col gap-2 px-5 pb-5 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void setPassword(editing.id, editing.name, chosen.trim());
            }}
          >
            <PasswordField value={chosen} onChange={setChosen} autoFocus />
            <button
              type="submit"
              disabled={chosen.trim().length < 8}
              title={chosen.trim().length < 8 ? "At least 8 characters" : "Save"}
              className="rounded-xl border border-(--glass-border) bg-(--glass-fill) px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
            >
              Save
            </button>
          </form>
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
            className="w-full min-w-0 rounded-xl border border-(--glass-border) bg-(--glass-inset) px-3 py-2 text-sm placeholder:text-ink-muted sm:w-auto sm:flex-1"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex-1 rounded-xl border border-(--glass-border) bg-(--glass-fill) px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40 sm:flex-none"
          >
            {busy ? "…" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => void addPlayer(false)}
            disabled={busy || !name.trim()}
            className="flex-1 rounded-xl border border-(--glass-border) px-4 py-2 text-sm text-ink-secondary transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40 sm:flex-none"
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
            <span className="rounded-full border border-(--glass-border) px-2.5 py-0.5 text-xs tabular-nums text-ink-secondary">
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
            <p className="px-2 py-4 text-sm text-ink-muted">
              Nobody yet. Add the first player above.
            </p>
          )}

          <ul className="space-y-1">
            {people.map((p) => (
              <li
                key={key(p.name)}
                className="group flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-(--glass-inset)"
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
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                      <Badge on={p.whitelisted} label="whitelisted" />
                      <Badge on={!!p.account} label="account" />
                      <Badge on={p.account?.role === "admin"} label="panel admin" />
                      <Badge on={p.op} label="operator" />
                      {p.account?.lastLogin && (
                        <span>· signed in {relativeTime(Date.parse(p.account.lastLogin))}</span>
                      )}
                    </span>
                  </span>
                </span>

                {/* Revealed on hover for pointers, always shown for touch —
                    a finger never produces :hover, so these were unreachable. */}
                <span className="flex gap-1 opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                  {p.account ? (
                    <button
                      onClick={() => {
                        setEditing({ id: p.account!.id, name: p.name });
                        setChosen("");
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
                    >
                      Password
                    </button>
                  ) : (
                    <button
                      onClick={() => void grantAccount(p)}
                      className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
                    >
                      Give account
                    </button>
                  )}
                  <button
                    onClick={() => void removePerson(p)}
                    className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-critical"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="px-5 pb-4 text-xs text-ink-muted">
          Operators are granted from the shell —{" "}
          <code className="font-mono">make cmd C=&quot;op Nick&quot;</code> — so handing
          out server-wide power never happens by a stray click here. Whoever is an
          operator gets a panel admin account to match; everyone whitelisted gets a
          player one.
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
