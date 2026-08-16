import { withUser, json } from "@/lib/route";
import { getSnapshot } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => json(await getSnapshot()));
