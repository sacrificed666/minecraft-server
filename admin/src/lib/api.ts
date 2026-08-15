/**
 * Response shapes shared by the route handlers and the pages they feed.
 *
 * Types only — nothing here runs. Each handler annotates its payload with the
 * type below, so a field renamed on the server fails to compile on the client
 * rather than silently rendering "—".
 */
import type { BackupFile, DeclaredMod, ModFile } from "./files";
import type { Extra, ModProject } from "./modrinth";
import type { PlayerEntry } from "./mc";
import type { User } from "./users";

/** The subset of server.properties the panel displays. */
export type ServerSettings = {
  motd: string;
  difficulty: string;
  gamemode: string;
  levelName: string;
  levelSeed: string;
  viewDistance: string;
  simulationDistance: string;
  maxPlayers: string;
  pvp: string;
  onlineMode: string;
  whitelist: string;
  allowFlight: string;
  hardcore: string;
};

export type ServerResponse = {
  properties: ServerSettings;
  worldBytes: number | null;
  ops: PlayerEntry[];
  startedAt: number | null;
  mapUrl: string;
  mapPort: string;
  serverHost: string;
  mcVersion: string;
  neoforgeVersion: string;
  voicePort: string;
};

export type ModpackResponse =
  | { available: true; bytes: number; modified: number }
  | { available: false; hint: string };

export type BackupsResponse = { backups: BackupFile[] };
export type ModsResponse = {
  mods: ModFile[];
  declared: DeclaredMod[];
  projects: ModProject[];
};
export type UsersResponse = { users: User[] };
export type WhitelistResponse = { players: PlayerEntry[] };
export type LogsResponse = { lines: string[] };
export type ExtrasResponse = { extras: Extra[] };
