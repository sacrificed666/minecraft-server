import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { runCommand } from "@/lib/mc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Commands that would take the server down or hand out control are refused.
 * The panel is for day-to-day operation; stopping the server is a shell job,
 * where whoever does it can see what else is running.
 */
const BLOCKED = [/^stop\b/i, /^restart\b/i, /^op\b/i, /^deop\b/i];

const MAX_LENGTH = 300;

export async function POST(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let raw = "";
  try {
    const body = await request.json();
    raw = typeof body?.command === "string" ? body.command : "";
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  // Normalised before the blocklist runs, not after: "/stop" has to be matched
  // by the same rule that matches "stop".
  const command = raw.trim().replace(/^\/+/, "").trim();

  if (!command) {
    return NextResponse.json({ error: "Empty command" }, { status: 400 });
  }
  if (command.length > MAX_LENGTH) {
    return NextResponse.json({ error: "Command too long" }, { status: 400 });
  }
  if (BLOCKED.some((re) => re.test(command))) {
    return NextResponse.json(
      { error: `"${command.split(/\s+/)[0]}" is not available from the panel` },
      { status: 403 },
    );
  }

  try {
    const output = await runCommand(command);
    return NextResponse.json({ ok: true, output: output || "(no output)" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
}
