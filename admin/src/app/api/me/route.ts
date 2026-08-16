import { withUser, json } from "@/lib/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who the browser is signed in as — drives which nav items the UI shows.
export const GET = withUser(async (_request, session) => json(session));
