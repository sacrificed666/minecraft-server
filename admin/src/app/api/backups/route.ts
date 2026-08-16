import { withAdmin, json } from "@/lib/route";
import { listBackups } from "@/lib/files";
import type { BackupsResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () =>
  json({ backups: await listBackups() } satisfies BackupsResponse),
);
