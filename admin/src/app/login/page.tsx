"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json();
      setError(data.error ?? "Sign in failed");
    } catch {
      setError("Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass rise w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-(--glass-border)"
            style={{ background: "var(--glass-inset)" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" className="size-7" fill="var(--series-players)">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" opacity="0.55" />
              <rect x="1" y="9" width="6" height="6" rx="1" opacity="0.55" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Server Admin Panel</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in with the account you were given
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username"
            autoFocus
            autoComplete="username"
            className="w-full rounded-xl border border-(--glass-border) bg-(--glass-inset) px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-(--glass-border) bg-(--glass-inset) px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={busy || !password || !username}
            className="w-full rounded-xl border border-(--glass-border) bg-(--glass-fill) px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p
            className="mt-3 text-center text-sm"
            style={{ color: "var(--critical)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
