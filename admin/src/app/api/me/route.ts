import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who the browser is signed in as — drives which nav items the UI shows. */
export async function GET() {
  const { session, denied } = await requireUser();
  if (denied) return denied;

  return NextResponse.json(session, { headers: { "cache-control": "no-store" } });
}
