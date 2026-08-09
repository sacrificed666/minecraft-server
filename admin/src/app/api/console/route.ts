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
const BLOCKED = [/^\s*stop\b/i, /^\s*restart\b/i, /^\s*op\b/i, /^\s*deop\b/i];

export async function POST(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let command = "";
  try {
    const body = await request.json();
    command = typeof body?.command === "string" ? body.command.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!command) {
    return NextResponse.json({ error: "Empty command" }, { status: 400 });
  }
  if (command.length > 300) {
    return NextResponse.json({ error: "Command too long" }, { status: 400 });
  }
  if (BLOCKED.some((re) => re.test(command))) {
    return NextResponse.json(
      { error: `"${command.split(/\s+/)[0]}" is not available from the panel` },
      { status: 403 },
    );
  }

  try {
    const output = await runCommand(command.replace(/^\//, ""));
    return NextResponse.json({ ok: true, output: output || "(no output)" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
}
