import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { withRcon } from "./rcon";
import { readServerProperties } from "./files";

const DATA_DIR = process.env.MC_DATA_DIR ?? "/mcdata";

export type PlayerEntry = { uuid: string; name: string };
export type ServerStatus = {
  online: boolean;
  players: { online: number; max: number; names: string[] };
  tps: { dimension: string; tps: number; msPerTick: number }[];
  overallTps: number | null;
  error?: string;
};

// Minecraft usernames: 3-16 of [A-Za-z0-9_].
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function isValidName(name: string): boolean {
  return NAME_RE.test(name);
}

// "There are 2 of a max of 10 players online: Alex, Steve"
export function parsePlayerList(raw: string): {
  online: number;
  max: number;
  names: string[];
} {
  const clean = stripFormatting(raw);
  // [\s\S] rather than the `s` flag: the TS target here predates dotAll.
  const counts = clean.match(
    /There are (\d+) of a max of (\d+) players online:?\s*([\s\S]*)/,
  );
  if (!counts) return { online: 0, max: 0, names: [] };
  const names = counts[3]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return { online: Number(counts[1]), max: Number(counts[2]), names };
}

// "Overworld: 20.000 TPS (0.860 ms/tick)" — one line per dimension plus Overall.
export function parseTps(raw: string): {
  perDimension: { dimension: string; tps: number; msPerTick: number }[];
  overall: number | null;
} {
  const perDimension: { dimension: string; tps: number; msPerTick: number }[] = [];
  let overall: number | null = null;

  for (const line of stripFormatting(raw).split("\n")) {
    const m = line.match(/^\s*(.+?):\s*([\d.]+)\s*TPS\s*\(([\d.]+)\s*ms\/tick\)/);
    if (!m) continue;
    const [, label, tps, ms] = m;
    if (label.toLowerCase() === "overall") overall = Number(tps);
    else perDimension.push({ dimension: label, tps: Number(tps), msPerTick: Number(ms) });
  }
  return { perDimension, overall };
}

// Strips the section-sign colour codes the server mixes into RCON replies.
export function stripFormatting(raw: string): string {
  return raw.replace(/§[0-9a-fk-or]/gi, "").replace(/\[[0-9;]*m/g, "");
}

export async function fetchStatus(): Promise<ServerStatus> {
  try {
    return await withRcon(async (rcon) => {
      const [listRaw, tpsRaw] = [await rcon.send("list"), await rcon.send("neoforge tps")];
      const players = parsePlayerList(listRaw);
      const { perDimension, overall } = parseTps(tpsRaw);
      return { online: true, players, tps: perDimension, overallTps: overall };
    });
  } catch (err) {
    return {
      online: false,
      players: { online: 0, max: 0, names: [] },
      tps: [],
      overallTps: null,
      error: err instanceof Error ? err.message : "unreachable",
    };
  }
}

// Read from disk rather than RCON, which would lose the UUIDs.
async function readPlayerFile(file: string): Promise<PlayerEntry[]> {
  try {
    // Runtime-mounted path: tracing it would pull the project into the standalone output.
    const target = path.join(/*turbopackIgnore: true*/ DATA_DIR, file);
    const raw = await fs.readFile(/*turbopackIgnore: true*/ target, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is PlayerEntry =>
        typeof e === "object" && e !== null && "name" in e && "uuid" in e,
      )
      .map((e) => ({ uuid: String(e.uuid), name: String(e.name) }));
  } catch {
    return [];
  }
}

export const getWhitelist = () => readPlayerFile("whitelist.json");
export const getOps = () => readPlayerFile("ops.json");

// What an offline client presents: MD5 of the name, capitals included, as a
// version-3 UUID. `whitelist add` derives it from a lower-cased copy instead,
// which is why the panel writes the file rather than asking the server to.
export function offlineUuid(name: string): string {
  const digest = createHash("md5").update(`OfflinePlayer:${name}`).digest();
  digest[6] = (digest[6] & 0x0f) | 0x30;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function offlineMode(): Promise<boolean> {
  const properties = await readServerProperties();
  return properties["online-mode"] === "false";
}

// Written in place: the file is bind-mounted, so replacing it would leave the
// server holding a deleted inode.
async function writeWhitelist(entries: PlayerEntry[]): Promise<void> {
  const target = path.join(/*turbopackIgnore: true*/ DATA_DIR, "whitelist.json");
  await fs.writeFile(
    /*turbopackIgnore: true*/ target,
    `${JSON.stringify(entries, null, 2)}\n`,
    "utf8",
  );
  await withRcon((rcon) => rcon.send("whitelist reload"));
}

export async function whitelistAdd(name: string): Promise<string> {
  if (!(await offlineMode())) {
    return withRcon((rcon) => rcon.send(`whitelist add ${name}`)).then(stripFormatting);
  }
  const entries = await getWhitelist();
  if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    return `${name} is already whitelisted`;
  }
  await writeWhitelist([...entries, { uuid: offlineUuid(name), name }]);
  return `Added ${name} to the whitelist`;
}

export async function whitelistRemove(name: string): Promise<string> {
  if (!(await offlineMode())) {
    return withRcon((rcon) => rcon.send(`whitelist remove ${name}`)).then(stripFormatting);
  }
  const entries = await getWhitelist();
  const left = entries.filter((e) => e.name.toLowerCase() !== name.toLowerCase());
  if (left.length === entries.length) return `${name} is not whitelisted`;
  await writeWhitelist(left);
  return `Removed ${name} from the whitelist`;
}

// ENFORCE_WHITELIST applies to operators too, so a fresh server would lock its
// own owner out. OPS is seeded from .env; the whitelist is not.
export async function ensureOpsWhitelisted(): Promise<string[]> {
  const [ops, whitelist] = await Promise.all([getOps(), getWhitelist()]);
  const known = new Set(whitelist.map((e) => e.name.toLowerCase()));
  const missing = ops.filter((op) => !known.has(op.name.toLowerCase()));
  for (const op of missing) await whitelistAdd(op.name);
  return missing.map((op) => op.name);
}

export async function runCommand(command: string): Promise<string> {
  return withRcon((rcon) => rcon.send(command)).then(stripFormatting);
}
