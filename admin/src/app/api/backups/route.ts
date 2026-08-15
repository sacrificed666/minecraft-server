import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { listBackups } from "@/lib/files";
import type { BackupsResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(
    { backups: await listBackups() } satisfies BackupsResponse,
    { headers: { "cache-control": "no-store" } },
  );
}
