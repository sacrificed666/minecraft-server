import { withAdmin, json } from "@/lib/route";
import { runCommand } from "@/lib/mc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Commands that would take the server down or hand out control are refused.
const BLOCKED = ["stop", "restart", "op", "deop"];

const MAX_LENGTH = 300;

// A verb counts wherever it would actually run: on its own, or at the tail of
// an `execute … run` chain, which anchoring to the start of the line missed.
// The namespace is stripped first, because `minecraft:stop` is the same command.
function blockedVerb(command: string): string | null {
  const tokens = command.toLowerCase().split(/\s+/);
  return (
    tokens.find(
      (token, i) =>
        (i === 0 || tokens[i - 1] === "run") &&
        BLOCKED.includes(token.replace(/^minecraft:/, "")),
    ) ?? null
  );
}

export const POST = withAdmin(async (request) => {
  let raw = "";
  try {
    const body = await request.json();
    raw = typeof body?.command === "string" ? body.command : "";
  } catch {
    return json({ error: "Malformed request" }, { status: 400 });
  }

  // Normalised first, so "/stop" and "stop" hit the same rule.
  const command = raw.trim().replace(/^\/+/, "").trim();

  if (!command) {
    return json({ error: "Empty command" }, { status: 400 });
  }
  if (command.length > MAX_LENGTH) {
    return json({ error: "Command too long" }, { status: 400 });
  }
  const refused = blockedVerb(command);
  if (refused) {
    return json(
      { error: `"${refused}" is not available from the panel` },
      { status: 403 },
    );
  }

  try {
    const output = await runCommand(command);
    return json({ ok: true, output: output || "(no output)" });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
});
