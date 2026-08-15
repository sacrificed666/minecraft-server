import crypto from "node:crypto";
import { promisify } from "node:util";
import { migrate, pool } from "./db";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export type Role = "admin" | "player";
export type User = {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
  lastLogin: string | null;
};

/**
 * scrypt with a per-user salt, stored as `scrypt$<salt>$<hash>`. Node ships
 * it, so the image has no native dependency to build.
 */
const KEYLEN = 64;

async function hash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verify(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, KEYLEN);
  const a = Buffer.from(expected, "hex");
  return a.length === derived.length && crypto.timingSafeEqual(a, derived);
}

/** Minecraft usernames only — the same rule the whitelist enforces. */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Readable but not guessable: no ambiguous characters. */
export function generatePassword(length = 14): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listUsers(): Promise<User[]> {
  await migrate();
  const { rows } = await pool().query(
    `SELECT id, username, role, created_at, last_login
       FROM users ORDER BY role DESC, lower(username)`,
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    lastLogin: r.last_login ? r.last_login.toISOString() : null,
  }));
}

export async function createUser(
  username: string,
  role: Role = "player",
): Promise<{ user: User; password: string }> {
  await migrate();
  const password = generatePassword();
  const { rows } = await pool().query(
    `INSERT INTO users (username, password, role)
     VALUES ($1, $2, $3)
     RETURNING id, username, role, created_at, last_login`,
    [username, await hash(password), role],
  );
  const r = rows[0];
  return {
    user: {
      id: r.id,
      username: r.username,
      role: r.role,
      createdAt: r.created_at.toISOString(),
      lastLogin: null,
    },
    password,
  };
}

/** Minimum for a hand-typed password; generated ones are 14. */
export const MIN_PASSWORD = 8;

/**
 * Sets a password, generating one when the caller does not supply it.
 *
 * The stored value is a scrypt hash either way — there is no way to read an
 * existing password back, so "show me their password" is answered by setting
 * one you choose.
 */
export async function resetPassword(
  id: number,
  chosen?: string,
): Promise<string | null> {
  await migrate();
  const password = chosen && chosen.length >= MIN_PASSWORD ? chosen : generatePassword();
  const { rowCount } = await pool().query(
    `UPDATE users SET password = $1 WHERE id = $2`,
    [await hash(password), id],
  );
  return rowCount ? password : null;
}

export async function deleteUser(id: number): Promise<string | null> {
  await migrate();
  const { rows } = await pool().query(
    `DELETE FROM users WHERE id = $1 RETURNING username`,
    [id],
  );
  return rows[0]?.username ?? null;
}

/**
 * Makes sure everyone already trusted by the server has a panel account.
 *
 * Being on the whitelist or in ops.json is the decision to let someone in; the
 * account is bookkeeping that should follow it rather than be a second step an
 * admin has to remember. Passwords are generated and never shown — the admin
 * sets one when handing the account over.
 */
export async function ensureAccounts(
  names: string[],
  role: Role = "player",
): Promise<string[]> {
  await migrate();
  const wanted = names.filter((n) => USERNAME_RE.test(n));
  if (!wanted.length) return [];
  const lowered = wanted.map((n) => n.toLowerCase());

  const { rows } = await pool().query(
    `SELECT lower(username) AS name FROM users WHERE lower(username) = ANY($1)`,
    [lowered],
  );
  const have = new Set(rows.map((r) => r.name));
  const missing = wanted.filter((n) => !have.has(n.toLowerCase()));

  for (const name of missing) {
    await pool().query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING`,
      [name, await hash(generatePassword()), role],
    );
  }

  // A server operator already has full control of the world, so the panel
  // follows that rather than making it a second, separate grant. Only ever an
  // upgrade: losing op does not quietly take the panel account away.
  if (role === "admin") {
    await pool().query(
      `UPDATE users SET role = 'admin' WHERE lower(username) = ANY($1) AND role <> 'admin'`,
      [lowered],
    );
  }
  return missing;
}

export async function authenticate(
  username: string,
  password: string,
): Promise<{ username: string; role: Role } | null> {
  await migrate();
  const { rows } = await pool().query(
    `SELECT id, username, password, role FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  const row = rows[0];
  if (!row || !(await verify(password, row.password))) return null;
  await pool().query(`UPDATE users SET last_login = now() WHERE id = $1`, [row.id]);
  return { username: row.username, role: row.role };
}
