"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMetrics } from "./MetricsProvider";
import { StatusPill } from "./StatTile";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./SessionProvider";
import {
  IconBackups,
  IconConsole,
  IconLogout,
  IconMap,
  IconMods,
  IconOverview,
  IconPlayers,
  IconSettings,
  IconGuide,
} from "./Icons";

// adminOnly items disappear for players; the API enforces the same split, so
// hiding them is convenience rather than the security boundary.
const NAV = [
  { href: "/", label: "Overview", Icon: IconOverview, adminOnly: false },
  { href: "/map", label: "Map", Icon: IconMap, adminOnly: false },
  { href: "/mods", label: "Mods", Icon: IconMods, adminOnly: false },
  { href: "/guide", label: "Guide", Icon: IconGuide, adminOnly: false },
  { href: "/players", label: "Players", Icon: IconPlayers, adminOnly: true },
  { href: "/console", label: "Console", Icon: IconConsole, adminOnly: true },
  { href: "/backups", label: "Backups", Icon: IconBackups, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snap, stale, updatedAt } = useMetrics();
  const me = useSession();
  const isAdmin = me?.role === "admin";
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  const current = NAV.find((n) => n.href === pathname) ?? NAV[0];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-[var(--glass-border)] p-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <svg viewBox="0 0 16 16" className="size-7 shrink-0" fill="var(--series-players)">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" opacity="0.55" />
            <rect x="1" y="9" width="6" height="6" rx="1" opacity="0.55" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
          <span className="text-sm leading-tight font-semibold">
            {isAdmin ? "Server Admin" : "Server"}
            <span className="block text-[11px] font-normal text-[var(--ink-muted)]">
              {me ? `${me.username} · ${me.role}` : "NeoForge 1.21.1"}
            </span>
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-[var(--glass-fill)] font-medium text-[var(--ink-primary)]"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--glass-fill-2)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <Icon className={active ? "text-[var(--series-tps)]" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto" />
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--ink-secondary)] transition-colors hover:bg-[var(--glass-fill-2)] hover:text-[var(--critical)]"
        >
          <IconLogout />
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ─── Top bar ─── */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {current.label}
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              {stale
                ? "Reconnecting…"
                : updatedAt
                  ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <StatusPill online={snap?.online ?? false} />
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-xl border border-[var(--glass-border)] p-2 text-[var(--ink-secondary)] transition-colors hover:text-[var(--critical)] lg:hidden"
            >
              <IconLogout />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:pb-8">{children}</main>
      </div>

      {/* ─── Bottom tabs (mobile) ─── */}
      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex justify-around overflow-x-auto rounded-2xl px-1 py-1.5 lg:hidden">
        {nav.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] transition-colors ${
                active
                  ? "text-[var(--series-tps)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
