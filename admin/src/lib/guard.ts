import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession, type Session } from "./session";
import { SESSION_COOKIE } from "./constants";

/**
 * Real authorisation for route handlers. Middleware only sees whether a cookie
 * exists; these verify the signature, expiry and role.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

/** Any signed-in user. Returns a response to short-circuit with, or the session. */
export async function requireUser(): Promise<
  { session: Session; denied: null } | { session: null; denied: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { session, denied: null };
}

/** Admin-only endpoints. Players get 403, not 401 — they are signed in. */
export async function requireAdmin(): Promise<
  { session: Session; denied: null } | { session: null; denied: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (session.role !== "admin") {
    return {
      session: null,
      denied: NextResponse.json({ error: "admin only" }, { status: 403 }),
    };
  }
  return { session, denied: null };
}
