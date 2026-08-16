import fs from "node:fs/promises";
import path from "node:path";

// Resolves slugs into a title, an icon and a download for the current MC_VERSION.

const LIST_DIR = process.env.MODS_LIST_DIR ?? "/extras";
const MC_VERSION = process.env.MC_VERSION ?? "1.21.1";
const API = "https://api.modrinth.com/v2";
const TTL_MS = 6 * 60 * 60 * 1000;

export type Extra = {
  slug: string;
  kind: "shader" | "resourcepack";
  title: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
  version: string | null;
  fileUrl: string | null;
  fileBytes: number | null;
  pageUrl: string;
};

type Cache = { at: number; items: Extra[] };
const globalCache = globalThis as unknown as { __mcExtras?: Cache };

async function readSlugs(file: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(/*turbopackIgnore: true*/ LIST_DIR, file), "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "minecraft-server-admin-panel" },
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Project = {
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  project_type: string;
};
type Version = {
  version_number: string;
  version_type: string;
  files: { url: string; filename: string; size: number; primary: boolean }[];
};

async function resolve(slug: string, kind: Extra["kind"]): Promise<Extra | null> {
  const project = await json<Project>(`${API}/project/${slug}`);
  if (!project) return null;

  const versions =
    (await json<Version[]>(
      `${API}/project/${slug}/version?game_versions=%5B%22${MC_VERSION}%22%5D`,
    )) ?? [];
  const best = versions.find((v) => v.version_type === "release") ?? versions[0];
  const file = best?.files.find((f) => f.primary) ?? best?.files[0];

  return {
    slug,
    kind,
    title: project.title,
    description: project.description,
    iconUrl: project.icon_url,
    downloads: project.downloads,
    version: best?.version_number ?? null,
    fileUrl: file?.url ?? null,
    fileBytes: file?.size ?? null,
    pageUrl: `https://modrinth.com/${kind}/${slug}`,
  };
}

export async function listExtras(): Promise<Extra[]> {
  const cached = globalCache.__mcExtras;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.items;

  const [shaders, packs] = await Promise.all([
    readSlugs("shaders.txt"),
    readSlugs("resourcepacks.txt"),
  ]);

  const settled = await Promise.all([
    ...shaders.map((s) => resolve(s, "shader")),
    ...packs.map((s) => resolve(s, "resourcepack")),
  ]);
  const items = settled.filter((x): x is Extra => x !== null);

  // Keep the previous good list if Modrinth was unreachable for everything
  if (!items.length && cached) return cached.items;
  globalCache.__mcExtras = { at: Date.now(), items };
  return items;
}

export type ModProject = {
  slug: string;
  client: boolean;
  title: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
  pageUrl: string;
};

type ProjectsCache = { at: number; items: ModProject[] };
const globalMods = globalThis as unknown as { __mcModProjects?: ProjectsCache };

// Icons and titles for everything in mods.txt and client-mods.txt.
export async function listModProjects(): Promise<ModProject[]> {
  const cached = globalMods.__mcModProjects;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.items;

  const [server, client] = await Promise.all([
    readSlugs("mods.txt"),
    readSlugs("client-mods.txt"),
  ]);
  // Entries carry a pin as "slug:beta" or "slug=<version>"; the API wants neither
  const bare = (entry: string) => entry.split(/[:=]/)[0];
  const isClient = new Set(client.map(bare));
  const slugs = [...server, ...client].map(bare);
  if (!slugs.length) return [];

  const ids = encodeURIComponent(JSON.stringify(slugs));
  const projects = await json<(Project & { slug: string })[]>(`${API}/projects?ids=${ids}`);
  if (!projects) return cached?.items ?? [];

  const items = projects
    .map((p) => ({
      slug: p.slug,
      client: isClient.has(p.slug),
      title: p.title,
      description: p.description,
      iconUrl: p.icon_url,
      downloads: p.downloads,
      pageUrl: `https://modrinth.com/mod/${p.slug}`,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  globalMods.__mcModProjects = { at: Date.now(), items };
  return items;
}
