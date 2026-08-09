import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODPACK_DIR = process.env.MODPACK_DIR ?? "/modpack";
const FILE = "modpack.zip";

function target(): string {
  return path.join(/*turbopackIgnore: true*/ MODPACK_DIR, FILE);
}

/** HEAD-style metadata, so the UI can show the size without downloading. */
export async function GET(request: Request) {
  const { denied } = await requireUser();
  if (denied) return denied;

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(/*turbopackIgnore: true*/ target());
  } catch {
    return NextResponse.json(
      { available: false, hint: "Run `make modpack` on the host to build it." },
      { status: 404 },
    );
  }

  const wantsFile = new URL(request.url).searchParams.get("download") === "1";
  if (!wantsFile) {
    return NextResponse.json(
      { available: true, bytes: stat.size, modified: stat.mtimeMs },
      { headers: { "cache-control": "no-store" } },
    );
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
