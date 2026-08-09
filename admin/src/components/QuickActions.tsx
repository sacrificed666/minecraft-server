"use client";

import { useState } from "react";
import { GlassCard, CardHeader } from "./GlassCard";
import { useToast } from "./Toast";

const ACTIONS: { label: string; command: string; hint: string }[] = [
  { label: "☀ Day", command: "time set day", hint: "Set time to day" },
  { label: "☾ Night", command: "time set night", hint: "Set time to night" },
  { label: "☁ Clear", command: "weather clear", hint: "Clear the weather" },
  { label: "☂ Rain", command: "weather rain", hint: "Start rain" },
  { label: "💾 Save", command: "save-all flush", hint: "Flush the world to disk" },
];

export function QuickActions({ delay = 0 }: { delay?: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(command: string, label: string) {
    setBusy(command);
    try {
      const res = await fetch("/api/console", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      toast(res.ok ? "ok" : "error", res.ok ? `${label} — done` : data.error);
    } catch {
      toast("error", "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function broadcast(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    await run(`say ${text}`, "Broadcast");
    setMessage("");
  }

  return (
    <GlassCard delay={delay}>
      <CardHeader title="Quick actions" hint="One-tap commands over RCON" />

      <div className="flex flex-wrap gap-2 px-5 pb-3">
        {ACTIONS.map((a) => (
          <button
            key={a.command}
            onClick={() => void run(a.command, a.label)}
            disabled={busy !== null}
            title={a.hint}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-2)] px-3 py-2 text-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {busy === a.command ? "…" : a.label}
          </button>
        ))}
      </div>

      <form className="flex gap-2 px-5 pb-5" onSubmit={broadcast}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Broadcast a message to everyone…"
          aria-label="Broadcast message"
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-2)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
        />
        <button
          type="submit"
          disabled={busy !== null || !message.trim()}
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
        >
          Say
        </button>
      </form>
    </GlassCard>
  );
}
