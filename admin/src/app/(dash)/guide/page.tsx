"use client";

import { GlassCard, CardHeader } from "@/components/GlassCard";
import { useToast } from "@/components/Toast";
import { usePolled } from "@/lib/polling";
import type { ServerResponse } from "@/lib/api";

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
        <div className="space-y-2 text-sm text-ink-secondary">{children}</div>
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
      className="inline-flex items-center gap-2 rounded-lg bg-(--glass-inset) px-2.5 py-1 font-mono text-xs transition-colors hover:bg-(--glass-fill)"
      title="Copy"
    >
      {value}
      <span className="text-ink-muted">⧉</span>
    </button>
  );
}

function Path({ children }: { children: React.ReactNode }) {
  return <code className="font-mono wrap-break-word">{children}</code>;
}

export default function GuidePage() {
  const { data: info } = usePolled<ServerResponse>("/api/server");

  const host = info?.serverHost || "server.sacrificed.me";
  const mc = info?.mcVersion || "1.21.1";
  const neoforge = info?.neoforgeVersion || "21.1.248";
  const voicePort = info?.voicePort || "24454";
  // server.properties writes booleans as strings; anything but "true" is offline
  const licenceRequired = info?.properties?.onlineMode === "true";

  return (
    <div className="space-y-4">
      <GlassCard delay={0}>
        <CardHeader
          title="Joining the server"
          hint={`Minecraft ${mc} with NeoForge — about ten minutes, once`}
          accent="var(--series-players)"
        />
        <ol className="px-5 pb-2">
          <Step n={1} title="Get a launcher">
            {licenceRequired ? (
              <p>
                The official launcher, signed in with an account that owns Java
                Edition. The server verifies accounts, so it has to be a real one.
              </p>
            ) : (
              <>
                <p>
                  The server does not check Mojang accounts, so a licence is not
                  required — any launcher works as long as you can set your own
                  username. If you own the game, the official launcher is still
                  the simplest option.
                </p>
                <p className="text-ink-muted">
                  Whatever you use, your username <strong>is</strong> your
                  identity here. Pick the one the admin whitelisted and keep it.
                </p>
              </>
            )}
          </Step>

          <Step n={2} title={`Create a ${mc} profile`}>
            <p>
              Launch Minecraft <Copyable value={mc} /> once and quit. That creates
              the files the NeoForge installer expects.
            </p>
          </Step>

          <Step n={3} title="Install NeoForge">
            <p>
              Download the installer for <Copyable value={neoforge} /> from{" "}
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
            <p className="text-ink-muted">
              The version must match exactly. A different build refuses the
              connection with a version mismatch.
            </p>
          </Step>

          <Step n={4} title="Add the mods">
            <p>
              Download the modpack from the <strong>Mods</strong> page, unpack it,
              and copy everything inside <Path>mods/</Path> into your{" "}
              <Path>.minecraft/mods</Path> folder.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-ink-muted">
              <li>
                Windows: <Path>%appdata%\.minecraft\mods</Path>
              </li>
              <li>
                macOS: <Path>~/Library/Application Support/minecraft/mods</Path>
              </li>
              <li>
                Linux: <Path>~/.minecraft/mods</Path>
              </li>
            </ul>
            <p className="text-ink-muted">
              Create the folder if it does not exist, and empty it first if you
              were running other mods. The pack already includes the client-only
              ones — voice chat, the performance mods, the map — so there is
              nothing else to collect by hand.
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
            <p className="text-ink-muted">
              Your username has to be whitelisted — it is added automatically when
              your account here is created, so if you can read this, you are in.
            </p>
          </Step>

          <Step n={7} title="Optional: shaders and textures">
            <p>
              The <strong>Looks</strong> page lists packs that are known to work
              with this version. Shaders go in <Path>.minecraft/shaderpacks</Path>
              , resource packs in <Path>.minecraft/resourcepacks</Path>, and both
              are switched on inside the game.
            </p>
          </Step>
        </ol>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard delay={1}>
          <CardHeader title="Quick reference" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-5 text-sm">
            <dt className="text-ink-muted">Server</dt>
            <dd className="truncate text-right font-medium">{host}</dd>
            <dt className="text-ink-muted">Minecraft</dt>
            <dd className="text-right font-medium">{mc}</dd>
            <dt className="text-ink-muted">NeoForge</dt>
            <dd className="text-right font-medium tabular-nums">{neoforge}</dd>
            <dt className="text-ink-muted">Difficulty</dt>
            <dd className="text-right font-medium capitalize">
              {info?.properties?.difficulty || "hard"}
            </dd>
            <dt className="text-ink-muted">Licence</dt>
            <dd className="text-right font-medium">
              {licenceRequired ? "required" : "not required"}
            </dd>
            <dt className="text-ink-muted">Voice chat</dt>
            <dd className="text-right font-medium tabular-nums">UDP {voicePort}</dd>
            <dt className="text-ink-muted">Live map</dt>
            <dd className="truncate text-right font-medium">
              {info?.mapUrl ? (
                <a
                  href={info.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {info.mapUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
          <p className="px-5 pb-5 text-sm text-ink-muted">
            The map is rendered overnight, so freshly explored land shows up the
            next morning rather than straight away.
          </p>
        </GlassCard>

        <GlassCard delay={2}>
          <CardHeader title="If it goes wrong" />
          <dl className="space-y-2.5 px-5 pb-5 text-sm">
            <div>
              <dt className="font-medium">&quot;Mod rejections&quot; on connect</dt>
              <dd className="text-ink-secondary">
                Your mods folder does not match the server. Re-copy the modpack and
                remove anything extra.
              </dd>
            </div>
            <div>
              <dt className="font-medium">&quot;Not whitelisted&quot;</dt>
              <dd className="text-ink-secondary">
                The name in the launcher differs from the one registered here, down
                to capitalisation. Ask the admin to check the spelling.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Voice chat stays silent</dt>
              <dd className="text-ink-secondary">
                It needs UDP {voicePort} outbound. Most home networks allow it;
                locked-down office and campus ones usually do not.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Crash on startup, or very low FPS</dt>
              <dd className="text-ink-secondary">
                Almost always memory. Raise <Path>-Xmx</Path> and lower your render
                distance.
              </dd>
            </div>
          </dl>
        </GlassCard>
      </div>
    </div>
  );
}
