import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { listDeclaredMods, listMods } from "@/lib/files";
import { listModProjects } from "@/lib/modrinth";
import type { ModsResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;

  const [mods, declared, projects] = await Promise.all([
    listMods(),
    listDeclaredMods(),
    listModProjects(),
  ]);

  return NextResponse.json(
    { mods, declared, projects } satisfies ModsResponse,
    { headers: { "cache-control": "no-store" } },
  );
}
