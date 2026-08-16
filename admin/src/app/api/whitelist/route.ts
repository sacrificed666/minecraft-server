import { withAdmin, json } from "@/lib/route";
import { getWhitelist, isValidName, whitelistAdd, whitelistRemove } from "@/lib/mc";
import { ensureAccounts } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  return json(
    { players: await getWhitelist() },
    { headers: { "cache-control": "no-store" } },
  );
});

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

export const POST = withAdmin(async (request) => {
  const name = await readName(request);
  if (!name) {
    return json(
      { error: "Invalid username. Use 3-16 characters: letters, digits or _" },
      { status: 400 },
    );
  }

  try {
    const message = await whitelistAdd(name);
    // Whitelisting is the decision to let someone in; the account follows it.
    await ensureAccounts([name]).catch(() => []);
    return json({ ok: true, message, players: await getWhitelist() });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
});

export const DELETE = withAdmin(async (request) => {
  const name = await readName(request);
  if (!name) {
    return json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const message = await whitelistRemove(name);
    return json({ ok: true, message, players: await getWhitelist() });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "RCON failed" },
      { status: 502 },
    );
  }
});
