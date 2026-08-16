import { withUser, json } from "@/lib/route";
import { listDeclaredMods, listMods } from "@/lib/files";
import { listModProjects } from "@/lib/modrinth";
import type { ModsResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => {
  const [mods, declared, projects] = await Promise.all([
    listMods(),
    listDeclaredMods(),
    listModProjects(),
  ]);
  return json({ mods, declared, projects } satisfies ModsResponse);
});
