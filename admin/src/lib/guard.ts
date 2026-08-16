import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession, type Session } from "./session";
import { SESSION_COOKIE } from "./constants";

// Real authorisation for route handlers.
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

type Guarded =
  | { session: Session; denied: null }
  | { session: null; denied: NextResponse };

// Any signed-in user.
export async function requireUser(): Promise<Guarded> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { session, denied: null };
}

// Admin-only endpoints. Players get 403, not 401 — they are signed in.
export async function requireAdmin(): Promise<Guarded> {
  const result = await requireUser();
  if (result.denied || result.session.role === "admin") return result;
  return {
    session: null,
    denied: NextResponse.json({ error: "admin only" }, { status: 403 }),
  };
}
