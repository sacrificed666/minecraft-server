import { fetchStatus } from "./mc";
import { getContainerStats } from "./docker";

/**
 * In-memory time series for the dashboard charts.
 *
 * Deliberately not persisted: the panel shows a live window, and a restart
 * losing an hour of samples is cheaper than owning a database. Long-term
 * profiling is spark's job, in game.
 */

export type Sample = {
  t: number;
  players: number | null;
  tps: number | null;
  cpu: number | null;
};

export type Snapshot = {
  online: boolean;
  players: { online: number; max: number; names: string[] };
  overallTps: number | null;
  perDimensionTps: { dimension: string; tps: number; msPerTick: number }[];
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
  cpuPercent: number | null;
  history: Sample[];
  error?: string;
};

const WINDOW_MS = 30 * 60 * 1000;
const POLL_MS = 5000;
const MAX_SAMPLES = Math.ceil(WINDOW_MS / POLL_MS);

type State = {
  samples: Sample[];
  latest: Snapshot | null;
  timer: NodeJS.Timeout | null;
  polling: boolean;
};

// Survives hot reloads in dev; one collector per process in production.
const globalState = globalThis as unknown as { __mcPanelState?: State };
const state: State = (globalState.__mcPanelState ??= {
  samples: [],
  latest: null,
  timer: null,
  polling: false,
});

async function poll(): Promise<void> {
  if (state.polling) return;
  state.polling = true;
  try {
    const [status, stats] = await Promise.all([fetchStatus(), getContainerStats()]);

    state.samples.push({
      t: Date.now(),
      players: status.online ? status.players.online : null,
      tps: status.overallTps,
      cpu: stats?.cpuPercent ?? null,
    });
    if (state.samples.length > MAX_SAMPLES) {
      state.samples.splice(0, state.samples.length - MAX_SAMPLES);
    }

    state.latest = {
      online: status.online,
      players: status.players,
      overallTps: status.overallTps,
      perDimensionTps: status.tps,
      memoryBytes: stats?.memoryBytes ?? null,
      memoryLimitBytes: stats?.memoryLimitBytes ?? null,
      cpuPercent: stats?.cpuPercent ?? null,
      history: state.samples,
      error: status.error,
    };
  } finally {
    state.polling = false;
  }
}

function ensureCollector(): void {
  if (state.timer) return;
  state.timer = setInterval(() => void poll(), POLL_MS);
  // Never hold the process open just to collect metrics.
  state.timer.unref?.();
}

export async function getSnapshot(): Promise<Snapshot> {
  ensureCollector();
  if (!state.latest) await poll();
  return (
    state.latest ?? {
      online: false,
      players: { online: 0, max: 0, names: [] },
      overallTps: null,
      perDimensionTps: [],
      memoryBytes: null,
      memoryLimitBytes: null,
      cpuPercent: null,
      history: [],
      error: "no samples yet",
    }
  );
}
