import crypto from "node:crypto";
import { SESSION_COOKIE } from "./constants";
import type { Role } from "./users";

// Stateless session cookie: base64url(payload).base64url(HMAC-SHA256).

const COOKIE_NAME = SESSION_COOKIE;
const MAX_AGE_SECONDS = 60 * 60 * 12;

export type Session = { username: string; role: Role };

function secret(): Buffer {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET must be set to at least 16 characters");
  }
  return Buffer.from(value, "utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(session: Session): {
  name: string;
  value: string;
  maxAge: number;
} {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return {
    name: COOKIE_NAME,
    value: `${payload}.${sign(payload)}`,
    maxAge: MAX_AGE_SECONDS,
  };
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  // Fixed-length digests, so the comparison cannot be timed
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    if (data.role !== "admin" && data.role !== "player") return null;
    return { username: String(data.username), role: data.role };
  } catch {
    return null;
  }
}

// The bootstrap admin from .env.
export function checkEnvAdmin(username: string, password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const expectedUser = process.env.ADMIN_USERNAME ?? "admin";
  if (!expected) return false;
  if (username.toLowerCase() !== expectedUser.toLowerCase()) return false;
  // Hashed both sides: timingSafeEqual needs equal lengths.
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
