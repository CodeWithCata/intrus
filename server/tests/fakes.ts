import { RoomSession, type Conn, type Host, type Storage } from "../session.ts";
import type { ServerMessage } from "../protocol.ts";
import { PACKS, seqRng } from "./helpers.ts";

export class FakeConn implements Conn {
  playerId: string | null = null;
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  constructor(public id: string, public connectedAt: number, private sock: FakeSockets) {}
  send(data: string) { this.sent.push(data); }
  close(code?: number, reason?: string) { this.closed = { code, reason }; this.sock.drop(this); }
  messages(): ServerMessage[] { return this.sent.filter((s) => s !== "pong").map((s) => JSON.parse(s) as ServerMessage); }
  last<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return this.messages().filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type).at(-1);
  }
}

export class FakeSockets {
  list: FakeConn[] = [];
  n = 0;
  add(now: number): FakeConn { const c = new FakeConn("c" + ++this.n, now, this); this.list.push(c); return c; }
  drop(c: FakeConn) { this.list = this.list.filter((x) => x !== c); }
}

export class MemStorage implements Storage {
  data = new Map<string, unknown>();
  writes = 0;
  async get<T>(key: string) { return structuredClone(this.data.get(key)) as T | undefined; }
  async put(key: string, value: unknown) { this.writes++; this.data.set(key, structuredClone(value)); }
  async deleteAll() { this.data.clear(); }
}

/** A room "process": session + fake clock + fake sockets. restart() makes a new session over the SAME storage (like a wake-up). */
export class Rig {
  clock = 1_000_000;
  sockets = new FakeSockets();
  storage = new MemStorage();
  alarm: number | null | undefined = undefined;
  alarmSets = 0;
  validTicket = "good";
  session!: RoomSession;
  constructor(public code = "ABCDEF") { this.restart(); }

  host(): Host {
    return {
      code: this.code,
      packs: PACKS,
      now: () => this.clock,
      rng: seqRng([0.3, 0.6, 0.1]),
      connections: () => [...this.sockets.list],
      storage: this.storage,
      setAlarm: async (at) => { this.alarm = at; this.alarmSets++; },
      verifyTicket: async (_c, ticket) => ticket === this.validTicket
    };
  }
  restart() { this.session = new RoomSession(this.host()); }
  async wake() { this.restart(); await this.session.load(); }

  connect(): FakeConn { const c = this.sockets.add(this.clock); this.session.onConnect(c); return c; }
  async send(c: FakeConn, msg: unknown) { await this.session.onMessage(c, typeof msg === "string" ? msg : JSON.stringify(msg)); }
  async close(c: FakeConn) { this.sockets.drop(c); await this.session.onClose(c); }
  async advance(ms: number) { this.clock += ms; if (typeof this.alarm === "number" && this.alarm <= this.clock) { this.alarm = undefined; await this.session.onAlarm(); } }

  async host1(name = "Host") { const c = this.connect(); await this.send(c, { type: "create", name, ticket: "good", expires: 1 }); return c; }
  async guest(name: string) { const c = this.connect(); await this.send(c, { type: "join", name }); return c; }
  /** Host plus n-1 guests. */
  async table(n: number) { const host = await this.host1(); const guests: FakeConn[] = []; for (let i = 1; i < n; i++) guests.push(await this.guest("G" + i)); return { host, guests }; }
}

export const errorCode = (c: FakeConn) => c.last("error")?.code;
