import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { listMods } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;

  return NextResponse.json(
    { mods: await listMods() },
    { headers: { "cache-control": "no-store" } },
  );
}
