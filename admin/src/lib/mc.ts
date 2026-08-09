import fs from "node:fs/promises";
import path from "node:path";
import { withRcon } from "./rcon";

const DATA_DIR = process.env.MC_DATA_DIR ?? "/mcdata";

export type PlayerEntry = { uuid: string; name: string };
export type ServerStatus = {
  online: boolean;
  players: { online: number; max: number; names: string[] };
  tps: { dimension: string; tps: number; msPerTick: number }[];
  overallTps: number | null;
  error?: string;
};

/** Minecraft usernames: 3-16 of [A-Za-z0-9_]. Anything else never reaches RCON. */
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function isValidName(name: string): boolean {
  return NAME_RE.test(name);
}

/** "There are 2 of a max of 10 players online: Alex, Steve" */
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

/** "Overworld: 20.000 TPS (0.860 ms/tick)" — one line per dimension plus Overall. */
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

/** Strips the section-sign colour codes the server mixes into RCON replies. */
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

/**
 * Reads whitelist.json / ops.json straight off the server's data directory.
 * The files are authoritative and structured; parsing `/whitelist list` output
 * would be fragile and would not carry UUIDs.
 */
async function readPlayerFile(file: string): Promise<PlayerEntry[]> {
  try {
    // The bundler cannot resolve a runtime-mounted path, and tracing it would
    // pull the whole project into the standalone output.
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

export async function whitelistAdd(name: string): Promise<string> {
  return withRcon((rcon) => rcon.send(`whitelist add ${name}`)).then(stripFormatting);
}

export async function whitelistRemove(name: string): Promise<string> {
  return withRcon((rcon) => rcon.send(`whitelist remove ${name}`)).then(stripFormatting);
}

export async function runCommand(command: string): Promise<string> {
  return withRcon((rcon) => rcon.send(command)).then(stripFormatting);
}
