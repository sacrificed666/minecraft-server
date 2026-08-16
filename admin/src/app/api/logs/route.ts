import { withAdmin, json } from "@/lib/route";
import { tailLog } from "@/lib/files";
import type { LogsResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () =>
  json({ lines: await tailLog(300) } satisfies LogsResponse),
);
