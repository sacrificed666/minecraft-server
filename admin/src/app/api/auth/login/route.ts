import { NextResponse } from "next/server";
import { checkEnvAdmin, createSession, type Session } from "@/lib/session";
import { authenticate } from "@/lib/users";

export const runtime = "nodejs";

/**
 * Fixed-window rate limit per source address. In-memory on purpose: the panel
 * is a single instance behind Traefik, and a restart clearing the counters is
 * not a meaningful bypass given the delay it costs an attacker.
 */
const ATTEMPT_LIMIT = 8;
const WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > ATTEMPT_LIMIT;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Enter a username and password" },
      { status: 400 },
    );
  }

  // The env admin is checked first so a database outage never locks the
  // operator out of their own server.
  let session: Session | null = checkEnvAdmin(username, password)
    ? { username, role: "admin" }
    : null;

  if (!session) {
    try {
      session = await authenticate(username, password);
    } catch {
      return NextResponse.json(
        { error: "User database unavailable. The admin account still works." },
        { status: 503 },
      );
    }
  }

  if (!session) {
    // Deliberately does not say which half was wrong
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const cookie = createSession(session);
  const response = NextResponse.json({ ok: true, role: session.role });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  attempts.delete(ip);
  return response;
}
