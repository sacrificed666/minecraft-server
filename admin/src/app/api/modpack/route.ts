import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withUser, json } from "@/lib/route";
import type { ModpackResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODPACK_DIR = process.env.MODPACK_DIR ?? "/modpack";
const FILE = "modpack.zip";

// Runtime-mounted path: tracing it would pull the project into the standalone output.
const target = () => path.join(/*turbopackIgnore: true*/ MODPACK_DIR, FILE);

// Without `?download=1`, metadata only — a missing archive is 200, the download 404s.
export const GET = withUser(async (request) => {
  const wantsFile = new URL(request.url).searchParams.get("download") === "1";

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(/*turbopackIgnore: true*/ target());
  } catch {
    const body: ModpackResponse = {
      available: false,
      hint: "Run `make modpack` on the host to build it.",
    };
    return json(body, { status: wantsFile ? 404 : 200 });
  }

  if (!wantsFile) {
    const body: ModpackResponse = {
      available: true,
      bytes: stat.size,
      modified: stat.mtimeMs,
    };
    return json(body);
  }

  // Streamed: the archive is hundreds of megabytes and the container has 512M.
  const stream = fs.createReadStream(target());
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(stat.size),
      "content-disposition": `attachment; filename="${FILE}"`,
      "cache-control": "no-store",
    },
  });
});
