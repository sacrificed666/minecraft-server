// Container CPU and memory over the Docker Engine API, reached through a proxy
// that only answers reads. The socket itself is root on the host: anything
// holding it can start a privileged container, and this panel faces the
// internet. Without the proxy configured, the readings are simply absent.

const API = process.env.DOCKER_API ?? "";
const CONTAINER = process.env.MC_CONTAINER ?? "minecraft";

export type ContainerStats = {
  // Share of the whole host, 0-100 — `docker stats` counts multiples of one core.
  cpuPercent: number;
  cpuCores: number;
  memoryBytes: number;
  memoryLimitBytes: number;
};

type DockerStats = {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: {
    usage?: number;
    limit?: number;
    stats?: { inactive_file?: number };
  };
};

async function get(path: string): Promise<string> {
  if (!API) throw new Error("DOCKER_API is not set");
  const res = await fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`docker api ${res.status}`);
  return res.text();
}

// Container start time as epoch ms, for the uptime tile.
export async function getContainerUptime(): Promise<number | null> {
  try {
    const raw = await get(`/containers/${encodeURIComponent(CONTAINER)}/json`);
    const started: string | undefined = JSON.parse(raw)?.State?.StartedAt;
    const ms = started ? Date.parse(started) : NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export async function getContainerStats(): Promise<ContainerStats | null> {
  try {
    const raw = await get(`/containers/${encodeURIComponent(CONTAINER)}/stats?stream=false`);
    const s: DockerStats = JSON.parse(raw);

    const cpuDelta =
      (s.cpu_stats?.cpu_usage?.total_usage ?? 0) -
      (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
    const systemDelta =
      (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
    const cpus = s.cpu_stats?.online_cpus ?? 1;

    // Excluding reclaimable page cache is what makes this match `docker stats`.
    const usage = s.memory_stats?.usage ?? 0;
    const inactiveFile = s.memory_stats?.stats?.inactive_file ?? 0;

    return {
      cpuPercent: systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0,
      cpuCores: cpus,
      memoryBytes: Math.max(0, usage - inactiveFile),
      memoryLimitBytes: s.memory_stats?.limit ?? 0,
    };
  } catch {
    return null;
  }
}
