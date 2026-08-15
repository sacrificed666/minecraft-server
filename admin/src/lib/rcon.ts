import net from "node:net";

/**
 * Minimal Source RCON client. Written rather than pulled in: the protocol is
 * four fields wide and multi-packet replies need explicit reassembly.
 *
 * Packet: int32 LE length | int32 LE id | int32 LE type | body\0 | \0
 */

const TYPE_AUTH = 3;
const TYPE_AUTH_RESPONSE = 2;
const TYPE_EXEC = 2;
const TYPE_RESPONSE = 0;

const CONNECT_TIMEOUT_MS = 4000;
const COMMAND_TIMEOUT_MS = 8000;

function encode(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, "utf8");
  const buf = Buffer.alloc(14 + payload.length);
  buf.writeInt32LE(10 + payload.length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  payload.copy(buf, 12);
  // two trailing NULs: body terminator + empty string field
  buf.writeUInt8(0, 12 + payload.length);
  buf.writeUInt8(0, 13 + payload.length);
  return buf;
}

type Packet = { id: number; type: number; body: string };

export class RconError extends Error {}

export class Rcon {
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private handlers = new Map<number, (p: Packet) => void>();

  constructor(
    private host: string,
    private port: number,
    private password: string,
  ) {}

  private handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // A frame is complete once we hold its declared length plus the size field.
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (this.buffer.length < size + 4) break;
      const frame = this.buffer.subarray(4, size + 4);
      this.buffer = this.buffer.subarray(size + 4);
      const packet: Packet = {
        id: frame.readInt32LE(0),
        type: frame.readInt32LE(4),
        body: frame.subarray(8, frame.length - 2).toString("utf8"),
      };
      this.handlers.get(packet.id)?.(packet);
    }
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const onError = (err: Error) => {
        socket.destroy();
        reject(new RconError(`RCON connect failed: ${err.message}`));
      };
      socket.setTimeout(CONNECT_TIMEOUT_MS, () =>
        onError(new Error("timed out")),
      );
      socket.once("error", onError);
      socket.once("connect", () => {
        socket.setTimeout(0);
        socket.off("error", onError);
        socket.on("error", () => this.destroy());
        socket.on("close", () => this.destroy());
        socket.on("data", (c) => this.handleData(c));
        this.socket = socket;
        resolve();
      });
    });

    const id = this.nextId++;
    const ok = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), COMMAND_TIMEOUT_MS);
      // A failed auth answers with id -1; a good one echoes our id.
      const settle = (value: boolean) => {
        clearTimeout(timer);
        this.handlers.delete(id);
        this.handlers.delete(-1);
        resolve(value);
      };
      this.handlers.set(id, (p) => {
        if (p.type === TYPE_AUTH_RESPONSE) settle(true);
      });
      this.handlers.set(-1, () => settle(false));
      this.socket!.write(encode(id, TYPE_AUTH, this.password));
    });

    if (!ok) {
      this.destroy();
      throw new RconError("RCON authentication failed");
    }
  }

  /**
   * Minecraft splits long replies across packets with no end marker, so we
   * send a second, empty packet and treat its echo as the terminator.
   */
  async send(command: string): Promise<string> {
    if (!this.socket) throw new RconError("not connected");
    const id = this.nextId++;
    const sentinel = this.nextId++;

    return new Promise<string>((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => {
        cleanup();
        reject(new RconError(`RCON command timed out: ${command}`));
      }, COMMAND_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timer);
        this.handlers.delete(id);
        this.handlers.delete(sentinel);
      };

      this.handlers.set(id, (p) => {
        if (p.type === TYPE_RESPONSE) out += p.body;
      });
      this.handlers.set(sentinel, () => {
        cleanup();
        resolve(out);
      });

      this.socket!.write(encode(id, TYPE_EXEC, command));
      this.socket!.write(encode(sentinel, TYPE_RESPONSE, ""));
    });
  }

  destroy() {
    this.socket?.destroy();
    this.socket = null;
    for (const [, handler] of this.handlers) handler({ id: -1, type: -1, body: "" });
    this.handlers.clear();
  }
}

/** Opens a connection, runs the commands in order, always closes. */
export async function withRcon<T>(fn: (rcon: Rcon) => Promise<T>): Promise<T> {
  const host = process.env.RCON_HOST ?? "mc";
  const port = Number(process.env.RCON_PORT ?? 25575);
  const password = process.env.RCON_PASSWORD;
  if (!password) throw new RconError("RCON_PASSWORD is not set");

  const rcon = new Rcon(host, port, password);
  await rcon.connect();
  try {
    return await fn(rcon);
  } finally {
    rcon.destroy();
  }
}
