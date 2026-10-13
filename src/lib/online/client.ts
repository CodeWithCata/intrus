/**
 * The online client without any UI framework: login, reconnect, state and role handling.
 * `client.svelte.ts` wraps it in reactive state; tests drive it with a fake socket and a fake fetch.
 *
 * Flow: create = POST /api/new-code -> open the socket -> send "create" with the ticket.
 *       join   = open the socket -> send "join".
 *       resume / reconnect = open the socket -> send "rejoin" with the saved playerId + token.
 */
import type { ClientMessage, PublicState, Role, ServerMessage } from "./protocol.ts";
import type { MessageKey } from "#lib/i18n/ro.ts";
import { FATAL_ERRORS, clearSession, errorKey, httpUrl, isNewer, isValidCode, loadName, loadSession, saveSession, wsUrl, type KV } from "./room.ts";
import { ReconnectingSocket, realTimers, type SocketOptions } from "./socket.ts";

export type Status = "idle" | "connecting" | "in" | "reconnecting" | "closed";

export interface Snapshot {
  status: Status;
  code: string;
  /** What went wrong, as a message key (the UI translates it, so a language change applies at once), or null. Cleared by the next good message. */
  error: MessageKey | null;
  playerId: string | null;
  state: PublicState | null;
  /** When the current `state` arrived (ms): the timer counts down from here. */
  stateAt: number;
  role: Role | null;
  /** Points of the last resolved round, only for the host. */
  delta: Record<string, number> | null;
  rev: number;
}

export const IDLE: Snapshot = { status: "idle", code: "", error: null, playerId: null, state: null, stateAt: 0, role: null, delta: null, rev: 0 };

export interface ClientDeps {
  host: string | null;
  socket?: Pick<SocketOptions, "factory" | "timers" | "pingMs" | "maxAttempts">;
  fetchFn?: typeof fetch;
  storage?: KV | null;
  now?: () => number;
  name?: () => string;
  /** The avatar look code to send when logging in (drawn avatar only; undefined = let the server pick one). */
  look?: () => number | undefined;
}

export class OnlineClient {
  private snap: Snapshot = IDLE;
  private listeners = new Set<() => void>();
  private socket: ReconnectingSocket | null = null;
  private token: string | null = null;
  /** What the last login message was, so an error can be attributed to it (see receive()). */
  private lastLogin: ClientMessage["type"] | null = null;
  private intent: { kind: "create"; ticket: string; expires: number } | { kind: "join" } | { kind: "rejoin" } = { kind: "join" };
  /** Picked once per create / join attempt and sent with every login of it, so a repeat after a reconnect finds the same seat. */
  private nonce = "";
  private readonly now: () => number;

  constructor(private deps: ClientDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  get snapshot(): Snapshot {
    return this.snap;
  }
  get available(): boolean {
    return this.deps.host !== null;
  }
  get isHost(): boolean {
    return !!this.snap.playerId && this.snap.state?.hostId === this.snap.playerId;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const fn of [...this.listeners]) fn();
  }

  private fail(code: string): void {
    this.set({ error: errorKey(code) });
  }

  /* ---------------- starting ---------------- */

  /** Asks the server for a fresh code, then opens the room as host. */
  async create(): Promise<void> {
    if (!this.deps.host) return this.set({ status: "closed", error: "olUnavailable" });
    this.reset();
    this.nonce = crypto.randomUUID();
    this.set({ status: "connecting", error: null });
    try {
      const res = await (this.deps.fetchFn ?? fetch)(httpUrl(this.deps.host, "/api/new-code"), { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { code?: unknown; ticket?: unknown; expires?: unknown };
      if (typeof body.code !== "string" || typeof body.ticket !== "string" || typeof body.expires !== "number" || !isValidCode(body.code)) throw new Error("bad response");
      this.intent = { kind: "create", ticket: body.ticket, expires: body.expires };
      this.set({ code: body.code });
      this.open(body.code);
    } catch {
      this.set({ status: "closed", error: "mpConnFail" });
    }
  }

  join(code: string): void {
    if (!this.deps.host) return this.set({ status: "closed", error: "olUnavailable" });
    if (!isValidCode(code)) return this.set({ status: "closed", error: "olBadCode" });
    this.reset();
    this.nonce = crypto.randomUUID();
    this.intent = { kind: "join" };
    this.set({ status: "connecting", error: null, code });
    this.open(code);
  }

  /** Takes the saved seat back after a refresh. Returns false if there is nothing to resume. */
  resume(): boolean {
    if (!this.deps.host) return false;
    const s = loadSession(this.deps.storage);
    if (!s) return false;
    this.reset();
    this.token = s.token;
    this.intent = { kind: "rejoin" };
    this.set({ status: "connecting", error: null, code: s.code, playerId: s.playerId });
    this.open(s.code);
    return true;
  }

  /** Leaves on purpose: the seat is given up for good. */
  leave(): void {
    this.socket?.send(JSON.stringify({ type: "leave" } satisfies ClientMessage));
    clearSession(this.deps.storage);
    this.reset();
  }

  /** Back online / tab visible again: reconnect now instead of waiting for the backoff. */
  nudge(): void {
    // The socket gave up after its last attempt (a long sleep, a tunnel): the saved seat is still good, so try it again.
    if (this.snap.status === "closed" && this.snap.error === "mpDisconnected") {
      this.resume();
      return;
    }
    this.socket?.nudge();
  }

  send(msg: ClientMessage): boolean {
    return this.socket?.send(JSON.stringify(msg)) ?? false;
  }

  /* ---------------- internals ---------------- */

  private reset(): void {
    this.socket?.close();
    this.socket = null;
    this.token = null;
    this.snap = IDLE;
    for (const fn of [...this.listeners]) fn();
  }

  private open(code: string): void {
    const host = this.deps.host as string;
    this.socket = new ReconnectingSocket(
      () => wsUrl(host, code),
      {
        onOpen: () => this.login(),
        onMessage: (text) => this.receive(text),
        onClose: ({ code: closeCode, willRetry }) => {
          if (willRetry) this.set({ status: "reconnecting" });
          else if (closeCode === 4000) this.set({ status: "closed", error: "olReplaced" });
          else this.set({ status: "closed", error: this.snap.error ?? "mpDisconnected" });
        }
      },
      { ...this.deps.socket, timers: this.deps.socket?.timers ?? realTimers }
    );
    this.socket.connect();
  }

  /** First message after every (re)connect. Once we hold a seat we always rejoin it. */
  private login(): void {
    const name = (this.deps.name?.() ?? loadName(this.deps.storage)).trim();
    const seat = this.snap.playerId && this.token ? { playerId: this.snap.playerId, token: this.token } : null;
    const l = this.deps.look?.();
    let msg: ClientMessage;
    if (seat) msg = { type: "rejoin", ...seat, l };
    else if (this.intent.kind === "create") msg = { type: "create", nonce: this.nonce, name, l, ticket: this.intent.ticket, expires: this.intent.expires };
    else msg = { type: "join", nonce: this.nonce, name, l };
    this.lastLogin = msg.type;
    this.send(msg);
  }

  private receive(text: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(text) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "created":
      case "joined":
      case "rejoined":
        this.token = msg.token;
        saveSession({ code: msg.code, playerId: msg.playerId, token: msg.token }, this.deps.storage);
        this.set({ status: "in", code: msg.code, playerId: msg.playerId, error: null });
        break;
      case "state": {
        if (!isNewer(this.snap.rev, msg.rev)) return;
        const prev = this.snap.state;
        const newRound = msg.state.phase === "round" && prev?.phase !== "round";
        // A state is a good message: it clears a non-fatal error shown earlier (a stale tap, a refused action).
        const patch: Partial<Snapshot> = { state: msg.state, stateAt: this.now(), rev: msg.rev, error: null };
        if (msg.state.phase === "lobby") Object.assign(patch, { role: null, delta: null });
        else if (newRound) patch.delta = null;
        this.set(patch);
        break;
      }
      case "role":
        this.set({ role: msg.role });
        break;
      case "delta":
        this.set({ delta: msg.delta });
        break;
      case "error":
        if (FATAL_ERRORS.includes(msg.code)) {
          // Forget the saved seat only when the server rejected the REJOIN of that seat. A "no-room" answer to a plain
          // JOIN (a mistyped or ended room) says nothing about the seat saved for another room, so that one is kept.
          if (msg.code === "bad-token" || (msg.code === "no-room" && this.lastLogin === "rejoin")) clearSession(this.deps.storage);
          this.socket?.close();
          this.socket = null;
          this.set({ status: "closed", error: errorKey(msg.code) });
        } else this.fail(msg.code);
        break;
    }
  }
}
