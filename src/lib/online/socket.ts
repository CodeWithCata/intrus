/**
 * A WebSocket that reconnects by itself: exponential backoff with jitter, a plain-text "ping" heartbeat that also
 * detects a dead connection, and "stop for good" close codes. It knows nothing about the game protocol.
 * The socket factory and timers are injectable, so it is tested without a network.
 */

export const READY_OPEN = 1;

export interface WSLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((e: unknown) => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number; reason?: string }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  random(): number;
  now(): number;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  random: () => Math.random(),
  now: () => Date.now()
};

export interface SocketEvents {
  onOpen(): void;
  onMessage(text: string): void;
  /** `willRetry` false means this socket is finished (closed on purpose, a no-retry code, or out of attempts). */
  onClose(info: { code: number; willRetry: boolean }): void;
}

export interface SocketOptions {
  factory?: (url: string) => WSLike;
  timers?: Timers;
  pingMs?: number;
  maxAttempts?: number;
  /** Close codes after which retrying is pointless: 1003 text only, 1009 too big, 4000 replaced by another connection. */
  noRetryCodes?: readonly number[];
}

/** Policy closes (rate limit, login timeout, busy room) wait at least this long before retrying. */
const POLICY_DELAY_MS = 5000;
const MAX_DELAY_MS = 30_000;
/** After a wake-up ping, how long to wait for ANY message before calling the connection dead. */
const PROBE_MS = 3000;

export class ReconnectingSocket {
  private ws: WSLike | null = null;
  private attempts = 0;
  private retryTimer: unknown = null;
  private pingTimer: unknown = null;
  private lastRx = 0;
  private finished = false;
  private readonly timers: Timers;
  private readonly pingMs: number;
  private readonly maxAttempts: number;
  private readonly noRetry: readonly number[];

  constructor(private url: () => string, private events: SocketEvents, private opts: SocketOptions = {}) {
    this.timers = opts.timers ?? realTimers;
    this.pingMs = opts.pingMs ?? 25_000;
    this.maxAttempts = opts.maxAttempts ?? 10;
    this.noRetry = opts.noRetryCodes ?? [1003, 1009, 4000];
  }

  get open(): boolean {
    return this.ws !== null && this.ws.readyState === READY_OPEN;
  }

  connect(): void {
    if (this.finished || this.ws) return;
    const factory = this.opts.factory ?? ((u: string) => new WebSocket(u) as unknown as WSLike);
    const ws = factory(this.url());
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempts = 0;
      this.lastRx = this.timers.now();
      this.pingTimer = this.timers.setInterval(() => this.beat(), this.pingMs);
      this.events.onOpen();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastRx = this.timers.now();
      if (e.data === "pong") return;
      this.events.onMessage(String(e.data));
    };
    ws.onerror = () => {
      /* a close event always follows */
    };
    ws.onclose = (e) => this.handleClose(ws, e.code);
  }

  /** What to do when `ws` is gone: stop for good, or schedule the next attempt. Ignored for a socket that was already replaced. */
  private handleClose(ws: WSLike, code: number): void {
    if (this.ws !== ws) return;
    this.ws = null;
    this.stopBeat();
    if (this.finished) return;
    const stop = this.noRetry.includes(code) || this.attempts >= this.maxAttempts;
    if (stop) {
      this.finished = true;
      this.events.onClose({ code, willRetry: false });
      return;
    }
    this.attempts += 1;
    const base = Math.min(MAX_DELAY_MS, 500 * 2 ** (this.attempts - 1));
    const policy = code === 1008 || code === 1013 ? POLICY_DELAY_MS : 0;
    const delay = Math.max(policy, base * (0.5 + this.timers.random() / 2));
    this.events.onClose({ code, willRetry: true });
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Gives up on a connection that looks open but is dead (a phone that slept keeps a socket the browser still calls OPEN, and a
   * close on it can take a minute to be reported). Close it AND carry on at once, instead of waiting for the browser's report.
   */
  private kill(ws: WSLike): void {
    try {
      ws.close(4001, "dead");
    } catch {
      /* already closed */
    }
    this.handleClose(ws, 4001);
  }

  send(text: string): boolean {
    if (!this.ws || this.ws.readyState !== READY_OPEN) return false;
    this.ws.send(text);
    return true;
  }

  /**
   * The phone came back online / the tab became visible. If we are waiting to retry, reconnect right now. If the socket looks open,
   * check that it still is: ping it, and if nothing at all arrives within PROBE_MS it is dead, so reconnect (a tap on a dead socket
   * would otherwise be "sent" into nothing).
   */
  nudge(): void {
    if (this.finished) return;
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.connect();
      return;
    }
    const ws = this.ws;
    if (ws && ws.readyState === READY_OPEN) {
      const asked = this.timers.now();
      try {
        ws.send("ping");
      } catch {
        /* the close handler deals with it */
      }
      this.timers.setTimeout(() => {
        if (this.ws === ws && this.lastRx < asked) this.kill(ws);
      }, PROBE_MS);
    }
  }

  /** Close for good. No retry, no more events. */
  close(): void {
    this.finished = true;
    if (this.retryTimer !== null) this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopBeat();
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close(1000, "bye");
    } catch {
      /* already closed */
    }
  }

  private beat(): void {
    if (!this.ws) return;
    if (this.timers.now() - this.lastRx > this.pingMs * 2.2) {
      // nothing, not even a pong: the connection is dead. Close it and go on to the normal retry path.
      this.kill(this.ws);
      return;
    }
    try {
      this.ws.send("ping");
    } catch {
      /* the close handler deals with it */
    }
  }

  private stopBeat(): void {
    if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}
