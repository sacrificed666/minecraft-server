"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMetrics } from "./providers/MetricsProvider";
import { StatusPill } from "./StatTile";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./providers/SessionProvider";
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
  IconLooks,
} from "./Icons";

// Convenience only — the API enforces the same split.
const NAV = [
  { href: "/", label: "Overview", Icon: IconOverview, adminOnly: false },
  { href: "/map", label: "Map", Icon: IconMap, adminOnly: false },
  { href: "/mods", label: "Mods", Icon: IconMods, adminOnly: false },
  { href: "/looks", label: "Looks", Icon: IconLooks, adminOnly: false },
  { href: "/guide", label: "Guide", Icon: IconGuide, adminOnly: false },
  { href: "/players", label: "Players", Icon: IconPlayers, adminOnly: true },
  { href: "/console", label: "Console", Icon: IconConsole, adminOnly: true },
  { href: "/backups", label: "Backups", Icon: IconBackups, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: snap, stale, updatedAt } = useMetrics();
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-(--glass-border) p-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <svg viewBox="0 0 16 16" className="size-7 shrink-0" fill="var(--series-players)">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" opacity="0.55" />
            <rect x="1" y="9" width="6" height="6" rx="1" opacity="0.55" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
          <span className="text-sm leading-tight font-semibold">
            {isAdmin ? "Server Admin" : "Server"}
            <span className="block text-[11px] font-normal text-ink-muted">
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
                    ? "bg-(--glass-fill) font-medium text-ink"
                    : "text-ink-secondary hover:bg-(--glass-inset) hover:text-ink"
                }`}
              >
                <Icon className={active ? "text-(--series-tps)" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto" />
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-secondary transition-colors hover:bg-(--glass-inset) hover:text-critical"
        >
          <IconLogout />
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ─── Top bar ─── */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-(--glass-border) px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {current.label}
            </h1>
            <p className="text-xs text-ink-muted">
              {stale
                ? "Reconnecting…"
                : updatedAt
                  ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <StatusPill online={snap?.online ?? false} />
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-xl border border-(--glass-border) p-2 text-ink-secondary transition-colors hover:text-critical lg:hidden"
            >
              <IconLogout />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:pb-8">{children}</main>
      </div>

      {/* ─── Bottom tabs (mobile) ─── */}
      <nav
        className="glass fixed inset-x-3 bottom-3 z-30 grid rounded-2xl px-1 py-1.5 lg:hidden"
        // The labelled tab needs more room than the icon-only ones
        style={{
          gridTemplateColumns: nav
            .map((n) => (n.href === current.href ? "1.9fr" : "1fr"))
            .join(" "),
        }}
      >
        {nav.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition-colors ${
                active
                  ? "text-(--series-tps)"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon />
              {/* Only the active tab is labelled: eight labels at this width
                  truncate to "Overv…", which reads worse than the icon alone. */}
              {active && <span className="w-full truncate text-center">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
