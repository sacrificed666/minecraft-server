"use client";

import { useRef, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { useToast } from "@/components/Toast";

type Line = { id: number; kind: "in" | "out" | "err"; text: string };

const SUGGESTIONS = [
  "list",
  "neoforge tps",
  "whitelist list",
  "time set day",
  "weather clear",
  "save-all",
  "bluemap status",
];

export function ConsolePanel({ delay = 0 }: { delay?: number }) {
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  // Shell-style history: ↑ walks back through what was actually sent
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);

  function push(kind: Line["kind"], text: string) {
    setLines((prev) => [...prev.slice(-80), { id: nextId.current++, kind, text }]);
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd || busy) return;
    setBusy(true);
    history.current = [cmd, ...history.current.filter((c) => c !== cmd)].slice(0, 50);
    cursor.current = -1;
    push("in", cmd);
    setCommand("");
    try {
      const res = await fetch("/api/console", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      if (res.ok) {
        push("out", data.output);
      } else {
        push("err", data.error);
        toast("error", data.error);
      }
    } catch {
      push("err", "Request failed");
      toast("error", "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (cursor.current + 1 < history.current.length) {
        cursor.current += 1;
        setCommand(history.current[cursor.current]);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (cursor.current > 0) {
        cursor.current -= 1;
        setCommand(history.current[cursor.current]);
      } else {
        cursor.current = -1;
        setCommand("");
      }
    }
  }

  return (
    <GlassCard delay={delay} className="flex h-full flex-col">
      <CardHeader
        title="Console"
        hint="Runs over RCON. stop, restart, op and deop are blocked."
        right={
          lines.length > 0 && (
            <button
              onClick={() => setLines([])}
              className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
            >
              Clear
            </button>
          )
        }
      />

      <div
        ref={logRef}
        className="mx-3 min-h-48 flex-1 overflow-y-auto rounded-xl bg-(--glass-inset) p-3 font-mono text-xs leading-relaxed"
        role="log"
        aria-live="polite"
      >
        {lines.length === 0 && (
          <p className="text-ink-muted">
            Try a shortcut below, or type a command. ↑ and ↓ walk through history.
          </p>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className="rise whitespace-pre-wrap wrap-break-word"
            style={{
              color:
                line.kind === "err"
                  ? "var(--critical)"
                  : line.kind === "in"
                    ? "var(--ink-muted)"
                    : "var(--ink-primary)",
            }}
          >
            {line.kind === "in" ? `> ${line.text}` : line.text}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void run(s)}
            disabled={busy}
            className="rounded-lg border border-(--glass-border) px-2 py-1 font-mono text-[11px] text-ink-secondary transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(command);
        }}
      >
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="say Hello everyone"
          aria-label="Server command"
          maxLength={300}
          className="min-w-0 flex-1 rounded-xl border border-(--glass-border) bg-(--glass-inset) px-3 py-2 font-mono text-sm placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={busy || !command.trim()}
          className="rounded-xl border border-(--glass-border) bg-(--glass-fill) px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
        >
          {busy ? "…" : "Run"}
        </button>
      </form>
    </GlassCard>
  );
}
