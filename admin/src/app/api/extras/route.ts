import { withUser, json } from "@/lib/route";
import { listExtras } from "@/lib/modrinth";
import type { ExtrasResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () =>
  json({ extras: await listExtras() } satisfies ExtrasResponse),
);
