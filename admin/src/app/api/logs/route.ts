import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { tailLog } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(
    { lines: await tailLog(300) },
    { headers: { "cache-control": "no-store" } },
  );
}
