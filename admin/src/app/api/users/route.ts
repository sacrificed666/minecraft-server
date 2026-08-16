import { withAdmin, json } from "@/lib/route";
import {
  createUser,
  deleteUser,
  ensureAccounts,
  listUsers,
  MIN_PASSWORD,
  resetPassword,
  USERNAME_RE,
} from "@/lib/users";
import { ensureOpsWhitelisted, getOps, getWhitelist } from "@/lib/mc";
import { whitelistAdd, whitelistRemove } from "@/lib/mc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  try {
    // Anyone the server already trusts gets an account, so the lists cannot drift.
    await ensureOpsWhitelisted().catch(() => []);
    const [whitelist, ops] = await Promise.all([getWhitelist(), getOps()]);
    await ensureAccounts(whitelist.map((p) => p.name));
    await ensureAccounts(ops.map((p) => p.name), "admin");

    return json({ users: await listUsers() });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "database unavailable" },
      { status: 503 },
    );
  }
});

// One step for both the account and the whitelist entry, so neither is forgotten.
export const POST = withAdmin(async (request) => {
  let username = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
  } catch {
    return json({ error: "Malformed request" }, { status: 400 });
  }

  if (!USERNAME_RE.test(username)) {
    return json(
      { error: "Use a Minecraft username: 3-16 letters, digits or _" },
      { status: 400 },
    );
  }

  let created;
  try {
    created = await createUser(username, "player");
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key")) {
      return json({ error: `${username} already exists` }, { status: 409 });
    }
    return json({ error: message || "database error" }, { status: 503 });
  }

  // The account exists either way; a whitelist failure is reported, not fatal.
  let whitelisted = true;
  let whitelistMessage = "";
  try {
    whitelistMessage = (await whitelistAdd(username)).trim();
  } catch (err) {
    whitelisted = false;
    whitelistMessage = err instanceof Error ? err.message : "RCON failed";
  }

  return json({
    ok: true,
    user: created.user,
    password: created.password,
    whitelisted,
    whitelistMessage,
    users: await listUsers(),
  });
});

export const DELETE = withAdmin(async (request) => {
  let id = 0;
  let alsoUnwhitelist = false;
  try {
    const body = await request.json();
    id = Number(body?.id);
    alsoUnwhitelist = body?.unwhitelist === true;
  } catch {
    return json({ error: "Malformed request" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const username = await deleteUser(id);
    if (!username) return json({ error: "No such user" }, { status: 404 });
    if (alsoUnwhitelist) {
      try {
        await whitelistRemove(username);
      } catch {
        // The account is gone either way; report the part that worked.
      }
    }
    return json({ ok: true, username, users: await listUsers() });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 503 },
    );
  }
});

// Sets a password.
export const PATCH = withAdmin(async (request) => {
  let id = 0;
  let chosen: string | undefined;
  try {
    const body = await request.json();
    id = Number(body?.id);
    if (typeof body?.password === "string" && body.password.length > 0) {
      chosen = body.password;
    }
  } catch {
    return json({ error: "Malformed request" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Invalid id" }, { status: 400 });
  }
  if (chosen && chosen.length < MIN_PASSWORD) {
    return json(
      { error: `Use at least ${MIN_PASSWORD} characters` },
      { status: 400 },
    );
  }

  try {
    const password = await resetPassword(id, chosen);
    if (!password) return json({ error: "No such user" }, { status: 404 });
    return json({ ok: true, password });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 503 },
    );
  }
});
