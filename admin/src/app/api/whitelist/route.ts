import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { getWhitelist, isValidName, whitelistAdd, whitelistRemove } from "@/lib/mc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(
    { players: await getWhitelist() },
    { headers: { "cache-control": "no-store" } },
  );
}

async function readName(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    // Validate before the value ever reaches an RCON command string.
    return isValidName(name) ? name : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const name = await readName(request);
  if (!name) {
    return NextResponse.json(
      { error: "Invalid username. Use 3-16 characters: letters, digits or _" },
      { status: 400 },
    );
  }

  try {
    const message = await whitelistAdd(name);
    return NextResponse.json({ ok: true, message, players: await getWhitelist() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const name = await readName(request);
  if (!name) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const message = await whitelistRemove(name);
    return NextResponse.json({ ok: true, message, players: await getWhitelist() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
}
