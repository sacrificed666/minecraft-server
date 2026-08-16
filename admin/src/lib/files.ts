import fs from "node:fs/promises";
import path from "node:path";

// Read-only views over the server's own directories, so nothing can drift.

const DATA_DIR = process.env.MC_DATA_DIR ?? "/mcdata";
const BACKUP_DIR = process.env.MC_BACKUP_DIR ?? "/backups";

// Runtime-mounted paths: tracing them would bloat the standalone output.
const join = (base: string, ...rest: string[]) =>
  path.join(/*turbopackIgnore: true*/ base, ...rest);

export type BackupFile = { name: string; bytes: number; modified: number };
export type ModFile = { name: string; bytes: number };

export async function listBackups(): Promise<BackupFile[]> {
  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ BACKUP_DIR);
    const files = await Promise.all(
      entries
        .filter((n) => n.endsWith(".tar.gz") || n.endsWith(".tgz") || n.endsWith(".zip"))
        .map(async (name) => {
          const stat = await fs.stat(join(BACKUP_DIR, name));
          return { name, bytes: stat.size, modified: stat.mtimeMs };
        }),
    );
    return files.sort((a, b) => b.modified - a.modified);
  } catch {
    return [];
  }
}

export async function listMods(): Promise<ModFile[]> {
  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ join(DATA_DIR, "mods"));
    const files = await Promise.all(
      entries
        .filter((n) => n.endsWith(".jar"))
        .map(async (name) => ({
          name,
          bytes: (await fs.stat(join(DATA_DIR, "mods", name))).size,
        })),
    );
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Last N lines of latest.log, with the server's colour codes removed.
export async function tailLog(lines = 200): Promise<string[]> {
  try {
    const raw = await fs.readFile(join(DATA_DIR, "logs", "latest.log"), "utf8");
    return raw
      .replace(/\[[0-9;]*m/g, "")
      .split("\n")
      .filter(Boolean)
      .slice(-lines);
  } catch {
    return [];
  }
}

const LIST_DIR = process.env.MODS_LIST_DIR ?? "/extras";

export type DeclaredMod = { slug: string; pin: string | null; client: boolean };

// The slugs from mods.txt and client-mods.txt.
export async function listDeclaredMods(): Promise<DeclaredMod[]> {
  const read = async (file: string, client: boolean): Promise<DeclaredMod[]> => {
    try {
      const raw = await fs.readFile(join(LIST_DIR, file), "utf8");
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((entry) => {
          // "slug", "slug:beta" or "slug=<version>" — the pin is either form
          const [slug, pin] = entry.split(/[:=]/);
          return { slug, pin: pin ?? null, client };
        });
    } catch {
      return [];
    }
  };
  const [server, client] = await Promise.all([
    read("mods.txt", false),
    read("client-mods.txt", true),
  ]);
  return [...server, ...client].sort((a, b) => a.slug.localeCompare(b.slug));
}

export type ServerProperties = Record<string, string>;

export async function readServerProperties(): Promise<ServerProperties> {
  try {
    const raw = await fs.readFile(join(DATA_DIR, "server.properties"), "utf8");
    const out: ServerProperties = {};
    for (const line of raw.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

// Recursive size of the world directory, in bytes.
export async function worldSize(levelName: string): Promise<number | null> {
  async function walk(dir: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(/*turbopackIgnore: true*/ dir, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) total += await walk(full);
      else if (entry.isFile()) total += (await fs.stat(full)).size;
    }
    return total;
  }
  try {
    return await walk(join(DATA_DIR, levelName));
  } catch {
    return null;
  }
}
