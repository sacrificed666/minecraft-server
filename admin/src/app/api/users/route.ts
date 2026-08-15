import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import {
  createUser,
  deleteUser,
  ensureAccounts,
  listUsers,
  MIN_PASSWORD,
  resetPassword,
  USERNAME_RE,
} from "@/lib/users";
import { getOps, getWhitelist } from "@/lib/mc";
import { whitelistAdd, whitelistRemove } from "@/lib/mc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  try {
    // Anyone the server already trusts gets an account, so the two lists cannot
    // drift apart just because someone was whitelisted from the shell.
    const [whitelist, ops] = await Promise.all([getWhitelist(), getOps()]);
    await ensureAccounts(whitelist.map((p) => p.name));
    await ensureAccounts(ops.map((p) => p.name), "admin");

    return NextResponse.json(
      { users: await listUsers() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database unavailable" },
      { status: 503 },
    );
  }
}

/**
 * Creating a user is two things at once: a panel account and a whitelist entry.
 * "Add a player" should not be two tools and a chance to forget one.
 */
export async function POST(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let username = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
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
      return NextResponse.json({ error: `${username} already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: message || "database error" }, { status: 503 });
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

  return NextResponse.json({
    ok: true,
    user: created.user,
    password: created.password,
    whitelisted,
    whitelistMessage,
    users: await listUsers(),
  });
}

export async function DELETE(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let id = 0;
  let alsoUnwhitelist = false;
  try {
    const body = await request.json();
    id = Number(body?.id);
    alsoUnwhitelist = body?.unwhitelist === true;
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const username = await deleteUser(id);
    if (!username) return NextResponse.json({ error: "No such user" }, { status: 404 });
    if (alsoUnwhitelist) {
      try {
        await whitelistRemove(username);
      } catch {
        /* the account is gone either way; report success for the part that worked */
      }
    }
    return NextResponse.json({ ok: true, username, users: await listUsers() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 503 },
    );
  }
}

/**
 * Sets a password. With no `password` field one is generated; either way the
 * plaintext is returned once and only a scrypt hash is stored, so an existing
 * password can never be read back.
 */
export async function PATCH(request: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let id = 0;
  let chosen: string | undefined;
  try {
    const body = await request.json();
    id = Number(body?.id);
    if (typeof body?.password === "string" && body.password.length > 0) {
      chosen = body.password;
    }
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (chosen && chosen.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Use at least ${MIN_PASSWORD} characters` },
      { status: 400 },
    );
  }

  try {
    const password = await resetPassword(id, chosen);
    if (!password) return NextResponse.json({ error: "No such user" }, { status: 404 });
    return NextResponse.json({ ok: true, password });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 503 },
    );
  }
}
