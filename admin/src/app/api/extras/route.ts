import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { listExtras } from "@/lib/modrinth";
import type { ExtrasResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;

  return NextResponse.json({ extras: await listExtras() } satisfies ExtrasResponse, {
    headers: { "cache-control": "no-store" },
  });
}
