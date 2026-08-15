import http from "node:http";

/**
 * Container CPU and memory over the Docker Engine API. Optional: without the
 * socket every call resolves to null and the UI hides those readings.
 */

const SOCKET = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";
const CONTAINER = process.env.MC_CONTAINER ?? "minecraft";

export type ContainerStats = {
  cpuPercent: number;
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

function get(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCKET, path, method: "GET", timeout: 5000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          res.statusCode && res.statusCode < 400
            ? resolve(body)
            : reject(new Error(`docker api ${res.statusCode}`)),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("docker api timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Container start time as epoch ms, for the uptime tile. */
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

    // Page cache is charged to the container but is reclaimable, so excluding
    // inactive_file is what makes this match `docker stats`.
    const usage = s.memory_stats?.usage ?? 0;
    const inactiveFile = s.memory_stats?.stats?.inactive_file ?? 0;

    return {
      cpuPercent:
        systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * cpus * 100 : 0,
      memoryBytes: Math.max(0, usage - inactiveFile),
      memoryLimitBytes: s.memory_stats?.limit ?? 0,
    };
  } catch {
    return null;
  }
}
