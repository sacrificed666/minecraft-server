import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import type { ModpackResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODPACK_DIR = process.env.MODPACK_DIR ?? "/modpack";
const FILE = "modpack.zip";

// The bundler cannot resolve a runtime-mounted path, and tracing it would pull
// the whole project into the standalone output.
const target = () => path.join(/*turbopackIgnore: true*/ MODPACK_DIR, FILE);

/**
 * Without `?download=1`, metadata only — so the UI can show the size without
 * pulling the archive. "Not built yet" is a successful answer to that question,
 * not a missing resource, so it answers 200; only the download itself 404s.
 */
export async function GET(request: Request) {
  const { denied } = await requireUser();
  if (denied) return denied;

  const wantsFile = new URL(request.url).searchParams.get("download") === "1";

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(/*turbopackIgnore: true*/ target());
  } catch {
    const body: ModpackResponse = {
      available: false,
      hint: "Run `make modpack` on the host to build it.",
    };
    return NextResponse.json(body, { status: wantsFile ? 404 : 200 });
  }

  if (!wantsFile) {
    const body: ModpackResponse = {
      available: true,
      bytes: stat.size,
      modified: stat.mtimeMs,
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  }

  // Streamed rather than buffered: the archive runs to hundreds of megabytes
  // and reading it into memory would blow the container's 512M limit.
  const stream = fs.createReadStream(target());
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(stat.size),
      "content-disposition": `attachment; filename="${FILE}"`,
      "cache-control": "no-store",
    },
  });
}
