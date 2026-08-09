import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { readServerProperties, worldSize } from "@/lib/files";
import { getOps } from "@/lib/mc";
import { getContainerUptime } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;

  const properties = await readServerProperties();
  const level = properties["level-name"] || "world";
  const [size, ops, startedAt] = await Promise.all([
    worldSize(level),
    getOps(),
    getContainerUptime(),
  ]);

  return NextResponse.json(
    {
      properties: {
        motd: properties["motd"] ?? "",
        difficulty: properties["difficulty"] ?? "",
        gamemode: properties["gamemode"] ?? "",
        levelName: level,
        levelSeed: properties["level-seed"] ?? "",
        viewDistance: properties["view-distance"] ?? "",
        simulationDistance: properties["simulation-distance"] ?? "",
        maxPlayers: properties["max-players"] ?? "",
        pvp: properties["pvp"] ?? "",
        onlineMode: properties["online-mode"] ?? "",
        whitelist: properties["white-list"] ?? "",
        allowFlight: properties["allow-flight"] ?? "",
        hardcore: properties["hardcore"] ?? "",
      },
      worldBytes: size,
      ops,
      startedAt,
      mapUrl: process.env.MAP_URL ?? "",
      serverHost: process.env.SERVER_HOST ?? "",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
