import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { getSnapshot } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;

  return NextResponse.json(await getSnapshot(), {
    headers: { "cache-control": "no-store" },
  });
}
