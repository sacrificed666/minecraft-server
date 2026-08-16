import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, requireUser } from "./guard";
import type { Session } from "./session";

// Every endpoint here reports live state, so nothing may be cached.
export function json<T>(body: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...init?.headers },
  });
}

type Handler = (
  request: NextRequest,
  session: Session,
) => Promise<Response> | Response;

// The returned function takes only the request: Next reserves the second
// argument for the route context and type-checks every handler against it.
function gate(
  check: typeof requireUser,
): (handler: Handler) => (request: NextRequest) => Promise<Response> {
  return (handler) => async (request) => {
    const { session, denied } = await check();
    return denied ?? handler(request, session);
  };
}

export const withUser = gate(requireUser);
export const withAdmin = gate(requireAdmin);
