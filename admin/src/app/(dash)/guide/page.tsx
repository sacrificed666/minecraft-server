"use client";

import { useEffect, useState } from "react";
import { GlassCard, CardHeader } from "@/components/GlassCard";
import { useToast } from "@/components/Toast";

type Info = { serverHost: string; mapUrl: string; properties: Record<string, string> };

const NEOFORGE_VERSION = "21.1.248";
const MC_VERSION = "1.21.1";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-xl text-sm font-semibold"
        style={{ background: "var(--glass-fill)", color: "var(--series-tps)" }}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-6">
        <h3 className="mb-1.5 font-semibold">{title}</h3>
        <div className="space-y-2 text-sm text-[var(--ink-secondary)]">{children}</div>
      </div>
    </li>
  );
}

function Copyable({ value }: { value: string }) {
  const toast = useToast();
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast("ok", "Copied");
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--glass-fill-2)] px-2.5 py-1 font-mono text-xs transition-colors hover:bg-[var(--glass-fill)]"
      title="Copy"
    >
      {value}
      <span className="text-[var(--ink-muted)]">⧉</span>
    </button>
  );
}

export default function GuidePage() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    fetch("/api/server", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  const host = info?.serverHost || "server.sacrificed.me";

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Joining the server"
          hint={`Minecraft ${MC_VERSION} with NeoForge — about ten minutes, once`}
          accent="var(--series-players)"
        />
        <ol className="px-5 pb-2">
          <Step n={1} title="Install the Minecraft launcher">
            <p>
              The official launcher, signed in with an account that owns Java
              Edition. The server runs in online mode, so cracked clients cannot
              connect.
            </p>
          </Step>

          <Step n={2} title={`Create a ${MC_VERSION} profile`}>
            <p>
              Launch Minecraft <Copyable value={MC_VERSION} /> once and quit. That
              creates the files the NeoForge installer expects.
            </p>
          </Step>

          <Step n={3} title="Install NeoForge">
            <p>
              Download the installer for <Copyable value={NEOFORGE_VERSION} /> from{" "}
              <a
                href="https://neoforged.net/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                neoforged.net
              </a>
              , run it and choose <strong>Install client</strong>.
            </p>
            <p className="text-[var(--ink-muted)]">
              The version must match exactly. A different build refuses the
              connection with a version mismatch.
            </p>
          </Step>

          <Step n={4} title="Add the mods">
            <p>
              Download the modpack from the <strong>Mods</strong> page, unpack it,
              and copy everything inside <code className="font-mono">mods/</code> into
              your <code className="font-mono">.minecraft/mods</code> folder.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-[var(--ink-muted)]">
              <li>
                Windows: <code className="font-mono">%appdata%\.minecraft\mods</code>
              </li>
              <li>
                macOS:{" "}
                <code className="font-mono">
                  ~/Library/Application Support/minecraft/mods
                </code>
              </li>
              <li>
                Linux: <code className="font-mono">~/.minecraft/mods</code>
              </li>
            </ul>
            <p className="text-[var(--ink-muted)]">
              Create the folder if it does not exist. Empty it first if you were
              running other mods.
            </p>
          </Step>

          <Step n={5} title="Allocate memory">
            <p>
              In the launcher, edit the NeoForge profile → More options → JVM
              arguments, and set <Copyable value="-Xmx6G" />. This pack will not
              run comfortably on the default 2 GB.
            </p>
          </Step>

          <Step n={6} title="Connect">
            <p>
              Start the NeoForge profile, then Multiplayer → Add Server, and enter{" "}
              <Copyable value={host} />
            </p>
            <p className="text-[var(--ink-muted)]">
              Your username has to be whitelisted — it is added automatically when
              your account here is created, so if you can read this, you are in.
            </p>
          </Step>
        </ol>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard delay={1}>
          <CardHeader title="Quick reference" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-5 text-sm">
            <dt className="text-[var(--ink-muted)]">Server</dt>
            <dd className="truncate text-right font-medium">{host}</dd>
            <dt className="text-[var(--ink-muted)]">Minecraft</dt>
            <dd className="text-right font-medium">{MC_VERSION}</dd>
            <dt className="text-[var(--ink-muted)]">NeoForge</dt>
            <dd className="text-right font-medium tabular-nums">{NEOFORGE_VERSION}</dd>
            <dt className="text-[var(--ink-muted)]">Difficulty</dt>
            <dd className="text-right font-medium capitalize">
              {info?.properties?.difficulty || "hard"}
            </dd>
          </dl>
        </GlassCard>

        <GlassCard delay={2}>
          <CardHeader title="If it goes wrong" />
          <dl className="space-y-2.5 px-5 pb-5 text-sm">
            <div>
              <dt className="font-medium">&quot;Mod rejections&quot; on connect</dt>
              <dd className="text-[var(--ink-secondary)]">
                Your mods folder does not match the server. Re-copy the modpack and
                remove anything extra.
              </dd>
            </div>
            <div>
              <dt className="font-medium">&quot;Not whitelisted&quot;</dt>
              <dd className="text-[var(--ink-secondary)]">
                The name in the launcher differs from the one registered here. Ask
                the admin to check the spelling.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Crash on startup, or very low FPS</dt>
              <dd className="text-[var(--ink-secondary)]">
                Almost always memory. Raise <code className="font-mono">-Xmx</code>{" "}
                and lower your render distance.
              </dd>
            </div>
          </dl>
        </GlassCard>
      </div>
    </div>
  );
}
