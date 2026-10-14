/**
 * Transport-agnostic room session: the networking glue around room-logic.
 * It knows nothing about PartyKit or Cloudflare. party.ts adapts a Durable Object to the small `Host` / `Conn`
 * interfaces below, and the tests use plain fakes, so every behaviour here runs under Node without a network.
 *
 *  - All messages are handled one at a time (a promise queue), so there are no races between awaits.
 *  - The room is saved to storage after every change, BEFORE anything is sent about it (hibernation-safe).
 *  - A dropped socket is disconnect() (the seat is held for the grace period); only {type:"leave"} is leaveRoom().
 *  - One alarm is kept up to date: grace-period expiry, sockets that never logged in, idle eviction.
 */
import { indexToCode, isLookCode } from "../src/lib/components/players/avatar-parts.ts";
import { PING, PONG, parseClientMessage, type ClientMessage, type ServerMessage } from "./protocol.ts";
import * as RL from "./room-logic.ts";
import type { Role, Room, WordPack } from "./types.ts";

export const MAX_SOCKETS = 30; // players + spectators + sockets that have not logged in yet
export const MAX_UNAUTH = 6; // sockets that have not sent create/join/rejoin yet
export const UNAUTH_TIMEOUT_MS = 15_000;
export const IDLE_MS = 30 * 60 * 1000; // a room with no sockets at all is deleted after this
export const RATE_CAPACITY = 20; // message burst per socket
export const RATE_REFILL_PER_SEC = 5;
export const MAX_STRIKES = 5; // rate-limit hits before the socket is closed

export interface Conn {
  readonly id: string;
  /** Which player this socket is logged in as. Must survive hibernation (the adapter keeps it in the socket's state). */
  playerId: string | null;
  readonly connectedAt: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface Host {
  readonly code: string;
  readonly packs: readonly WordPack[];
  now(): number;
  rng(): number;
  connections(): Conn[];
  storage: Storage;
  /** Set the single alarm (ms timestamp), or clear it with null. */
  setAlarm(at: number | null): Promise<void>;
  verifyTicket(code: string, ticket: string, expires: number): Promise<boolean>;
}

/** Bump when the saved shape changes in a way load() cannot migrate. A room saved by a NEWER version is dropped, never half-read. */
const STATE_VERSION = 1;

interface Persisted {
  /** Absent in rooms saved before versioning (treated as 0). */
  v?: number;
  room: Room;
  rev: number;
  touched: number;
}

interface Bucket {
  tokens: number;
  last: number;
  strikes: number;
}

const STATE_KEY = "room";

export class RoomSession {
  room: Room | null = null;
  rev = 0;
  private touched = 0;
  private alarmAt: number | null | undefined = undefined; // undefined = unknown (e.g. after a wake-up): set it next time
  private buckets = new Map<string, Bucket>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private host: Host) {}

  /** Restores the room after a restart or a wake-up from hibernation. */
  async load(): Promise<void> {
    const saved = await this.host.storage.get<Persisted>(STATE_KEY);
    if (!saved || (saved.v ?? 0) > STATE_VERSION) {
      this.room = null;
      return;
    }
    this.room = saved.room;
    const cur = this.room.current as (Partial<NonNullable<typeof this.room.current>>) | null;
    if (cur) {
      cur.seen ??= [];
      cur.talk ??= null;
      cur.revealed ??= false;
      cur.troll ??= false;
      cur.twin ??= null;
      cur.twist ??= null;
      cur.agentId ??= null;
      cur.word2 ??= null;
      cur.persona ??= null;
      cur.known ??= false;
      cur.customHint ??= null;
      cur.baseIntruders ??= cur.imposterIds?.length ?? 1;
      cur.question ??= null;
    }
    this.room.lastTwist ??= null;
    const st = this.room.settings;
    if (st) for (const k of ["tw", "qm", "troll", "twn", "kn"] as const) st[k] ??= false; // rooms saved before the game modes existed
    for (const p of this.room.players) if (!isLookCode((p as { l?: unknown }).l)) p.l = indexToCode(0); // seats saved before avatars existed
    this.rev = saved.rev;
    this.touched = saved.touched;
  }

  /* ---------------- entry points (called by the adapter) ---------------- */

  onConnect(conn: Conn): void {
    const all = this.host.connections();
    if (all.length > MAX_SOCKETS || all.filter((c) => c.playerId === null).length > MAX_UNAUTH) {
      conn.close(1013, "Room is busy");
      return;
    }
    this.enqueue(() => this.scheduleAlarm(this.host.now()));
  }

  onMessage(conn: Conn, raw: string): Promise<void> {
    return this.enqueue(() => this.handle(conn, raw));
  }

  onClose(conn: Conn): Promise<void> {
    return this.enqueue(async () => {
      this.buckets.delete(conn.id);
      const now = this.host.now();
      const pid = conn.playerId;
      if (this.room && pid && !this.host.connections().some((c) => c.id !== conn.id && c.playerId === pid)) {
        RL.disconnect(this.room, pid, now);
        await this.persist(now);
        this.broadcast(now);
      }
      await this.scheduleAlarm(now);
    });
  }

  onAlarm(): Promise<void> {
    return this.enqueue(async () => {
      const now = this.host.now();
      this.alarmAt = undefined;
      for (const c of this.host.connections()) {
        if (c.playerId === null && now - c.connectedAt >= UNAUTH_TIMEOUT_MS) c.close(1008, "Login timeout");
      }
      await this.sweepNow(now);
      if (this.room && this.host.connections().length === 0 && now - this.touched >= IDLE_MS) {
        this.room = null;
        await this.host.storage.deleteAll();
      }
      await this.scheduleAlarm(now);
    });
  }

  /* ---------------- internals ---------------- */

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run.catch((e) => console.error("session error", e));
  }

  private send(conn: Conn, msg: ServerMessage): void {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }

  private fail(conn: Conn, code: string, message: string): void {
    this.send(conn, { type: "error", code, message });
  }

  /** Token bucket per socket. Returns false when the socket is sending too fast. */
  private take(conn: Conn, now: number): boolean {
    const b = this.buckets.get(conn.id) ?? { tokens: RATE_CAPACITY, last: now, strikes: 0 };
    b.tokens = Math.min(RATE_CAPACITY, b.tokens + ((now - b.last) / 1000) * RATE_REFILL_PER_SEC);
    b.last = now;
    this.buckets.set(conn.id, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    b.strikes += 1;
    if (b.strikes >= MAX_STRIKES) conn.close(1008, "Too many messages");
    return false;
  }

  /** Saves the room as a new revision. `rev` is bumped HERE (not when sending) so it never goes backwards after a restart. */
  private async persist(now: number): Promise<void> {
    if (!this.room) return;
    const before = { rev: this.rev, touched: this.touched };
    this.touched = now;
    this.rev += 1;
    try {
      await this.host.storage.put(STATE_KEY, { v: STATE_VERSION, room: this.room, rev: this.rev, touched: this.touched } satisfies Persisted);
    } catch (e) {
      // Memory is ahead of storage now. Go back to what was saved, so nobody sees a state a restart would lose.
      this.rev = before.rev;
      this.touched = before.touched;
      await this.load().catch(() => {
        this.room = null;
      });
      throw e;
    }
  }

  /** Every logged-in socket gets the same public snapshot, tagged with the revision that persist() just saved. */
  private broadcast(now: number): void {
    if (!this.room) return;
    const payload = JSON.stringify({ type: "state", rev: this.rev, state: RL.publicState(this.room, now) } satisfies ServerMessage);
    for (const c of this.host.connections()) {
      if (c.playerId === null) continue;
      try {
        c.send(payload);
      } catch {
        /* gone */
      }
    }
  }

  private async sweepNow(now: number): Promise<void> {
    if (!this.room) return;
    const r = RL.sweep(this.room, now);
    if (r.removed.length || r.hostChanged) {
      await this.persist(now);
      this.broadcast(now);
    }
  }

  /** Keeps exactly one alarm: the earliest of grace expiry, login timeout and idle eviction. Writes only on change. */
  private async scheduleAlarm(now: number): Promise<void> {
    const conns = this.host.connections();
    const times: number[] = [];
    if (this.room) {
      const sweepAt = RL.nextSweepAt(this.room);
      if (sweepAt !== null) times.push(sweepAt);
      if (conns.length === 0) times.push(this.touched + IDLE_MS);
    }
    for (const c of conns) if (c.playerId === null) times.push(c.connectedAt + UNAUTH_TIMEOUT_MS);
    const at = times.length ? Math.max(Math.min(...times), now) : null;
    if (at === this.alarmAt) return;
    this.alarmAt = at;
    await this.host.setAlarm(at);
  }

  private async handle(conn: Conn, raw: string): Promise<void> {
    const now = this.host.now();
    if (!this.take(conn, now)) return this.fail(conn, "rate-limited", "Slow down.");
    if (raw === PING) return conn.send(PONG);
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.fail(conn, parsed.code, parsed.message);
    await this.sweepNow(now);
    try {
      await this.dispatch(conn, parsed.msg, now);
    } catch (e) {
      if (e instanceof RL.RoomError) this.fail(conn, e.code, e.message);
      else {
        console.error("handler error", e);
        this.fail(conn, "internal", "Something went wrong handling that message.");
      }
    }
    await this.scheduleAlarm(now);
  }

  private ack(conn: Conn, type: "created" | "joined" | "rejoined", room: Room, playerId: string): void {
    this.send(conn, { type, code: room.code, playerId, token: RL.tokenOf(room, playerId) ?? "", isHost: room.hostId === playerId });
  }

  /** Puts this connection on an existing seat (a rejoin, or a repeated create / join): the old connection of that seat is replaced. */
  private async takeSeat(conn: Conn, playerId: string, token: string, type: "created" | "joined" | "rejoined", look: unknown, now: number): Promise<void> {
    const room = this.room;
    if (!room) throw new RL.RoomError("no-room", "That room doesn't exist yet, or has ended.");
    if (!RL.rejoinRoom(room, playerId, token, look)) throw new RL.RoomError("bad-token", "Couldn't restore your seat.");
    for (const c of this.host.connections()) {
      if (c.id !== conn.id && c.playerId === playerId) {
        c.playerId = null;
        c.close(4000, "Replaced by a newer connection");
      }
    }
    conn.playerId = playerId;
    await this.persist(now);
    this.ack(conn, type, room, playerId);
    const role = RL.roleFor(room, playerId);
    if (role) this.send(conn, { type: "role", role });
  }

  private sendRoles(roles: Record<string, Role>): void {
    for (const c of this.host.connections()) {
      const role = c.playerId ? roles[c.playerId] : undefined;
      if (role) this.send(c, { type: "role", role });
    }
  }

  private async dispatch(conn: Conn, msg: ClientMessage, now: number): Promise<void> {
    const ctx = { packs: this.host.packs, now, rng: () => this.host.rng() };

    // ----- logging in -----
    if (msg.type === "create" || msg.type === "join" || msg.type === "rejoin") {
      if (conn.playerId) throw new RL.RoomError("already-in-room", "You're already in a room on this connection.");
      // The same create / join sent again (a reconnect before the first answer arrived) gets its own seat back.
      const known = msg.type !== "rejoin" && msg.nonce && this.room ? RL.playerByNonce(this.room, msg.nonce) : null;
      if (known && this.room) {
        await this.takeSeat(conn, known.id, known.token, msg.type === "create" ? "created" : "joined", msg.l, now);
      } else if (msg.type === "create") {
        if (this.room) throw new RL.RoomError("taken", "This code already has a host. Ask for a new one.");
        if (!(await this.host.verifyTicket(this.host.code, msg.ticket, msg.expires))) {
          throw new RL.RoomError("bad-ticket", "This code wasn't issued by the server or has expired.");
        }
        if (this.room) throw new RL.RoomError("taken", "This code already has a host. Ask for a new one."); // re-check after the await
        const pid = crypto.randomUUID();
        this.room = RL.createRoom(this.host.code, pid, msg.name, msg.l);
        conn.playerId = pid;
        if (msg.nonce) this.room.players[0].nonce = msg.nonce;
        await this.persist(now);
        this.ack(conn, "created", this.room, pid);
      } else if (msg.type === "join") {
        if (!this.room) throw new RL.RoomError("no-room", "That room doesn't exist yet, or has ended.");
        const pid = crypto.randomUUID();
        RL.joinRoom(this.room, pid, msg.name, msg.l);
        const seat = this.room.players.find((p) => p.id === pid);
        if (seat && msg.nonce) seat.nonce = msg.nonce;
        conn.playerId = pid;
        await this.persist(now);
        this.ack(conn, "joined", this.room, pid);
      } else {
        if (!this.room) throw new RL.RoomError("no-room", "That room doesn't exist yet, or has ended.");
        await this.takeSeat(conn, msg.playerId, msg.token, "rejoined", msg.l, now);
      }
      this.broadcast(now);
      return;
    }

    // ----- everything else needs a seat -----
    const room = this.room;
    const pid = conn.playerId;
    if (!room || !pid) throw new RL.RoomError("no-room", "Not in a room.");

    switch (msg.type) {
      case "look":
        RL.setLook(room, pid, msg.l);
        break;
      case "settings":
        RL.updateSettings(room, pid, msg.settings, this.host.packs);
        break;
      case "start": {
        const { roles } = RL.startRound(room, pid, { imposters: msg.imposters, hint: msg.hint }, ctx);
        await this.persist(now);
        this.sendRoles(roles);
        this.broadcast(now);
        return;
      }
      case "seen":
        RL.markSeen(room, pid);
        break;
      case "talk-start":
        RL.startTalk(room, pid, ctx);
        break;
      case "reveal":
        RL.revealRound(room, pid);
        break;
      case "vote-open":
        RL.openVote(room, pid);
        break;
      case "vote":
        RL.castVote(room, pid, msg.suspectId);
        break;
      case "vote-reveal":
        RL.revealVote(room, pid);
        break;
      case "question":
        RL.questionAction(room, pid, msg.action, ctx, msg.n);
        break;
      case "outcome": {
        const { delta } = RL.resolveOutcome(room, pid, msg.kind, msg.escapedIds);
        await this.persist(now);
        this.broadcast(now);
        this.send(conn, { type: "delta", delta });
        return;
      }
      case "timer":
        RL.timerAction(room, pid, msg.action, now);
        break;
      case "next-round":
        RL.nextRound(room, pid, now);
        break;
      case "leave":
        RL.leaveRoom(room, pid);
        conn.playerId = null;
        break;
      default: {
        const unreachable: never = msg;
        throw new Error("unhandled message " + String(unreachable));
      }
    }
    await this.persist(now);
    this.broadcast(now);
  }
}
