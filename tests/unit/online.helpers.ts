import type { Timers, WSLike } from "#lib/online/socket.ts";

export class FakeWS implements WSLike {
  readyState = 0;
  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;
  onopen: WSLike["onopen"] = null;
  onmessage: WSLike["onmessage"] = null;
  onclose: WSLike["onclose"] = null;
  onerror: WSLike["onerror"] = null;
  constructor(public url: string) {}
  send(data: string) { this.sent.push(data); }
  close(code?: number, reason?: string) { this.closedWith = { code, reason }; this.readyState = 3; }
  /* ---- test controls ---- */
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(data: unknown) { this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) }); }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code }); }
  json() { return this.sent.filter((s) => s !== "ping").map((s) => JSON.parse(s)); }
}

export class FakeTimers implements Timers {
  t = 0;
  private id = 0;
  private timeouts = new Map<number, { at: number; fn: () => void }>();
  private intervals = new Map<number, { every: number; next: number; fn: () => void }>();
  rnd = 0.5;
  setTimeout(fn: () => void, ms: number) { const id = ++this.id; this.timeouts.set(id, { at: this.t + ms, fn }); return id; }
  clearTimeout(h: unknown) { this.timeouts.delete(h as number); }
  setInterval(fn: () => void, ms: number) { const id = ++this.id; this.intervals.set(id, { every: ms, next: this.t + ms, fn }); return id; }
  clearInterval(h: unknown) { this.intervals.delete(h as number); }
  random() { return this.rnd; }
  now() { return this.t; }
  pending() { return this.timeouts.size; }
  nextTimeoutDelay() { const all = [...this.timeouts.values()].map((x) => x.at - this.t); return all.length ? Math.min(...all) : null; }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const due = [
        ...[...this.timeouts.entries()].map(([id, x]) => ({ at: x.at, run: () => { this.timeouts.delete(id); x.fn(); } })),
        ...[...this.intervals.values()].map((x) => ({ at: x.next, run: () => { x.next += x.every; x.fn(); } }))
      ].filter((x) => x.at <= end).sort((a, b) => a.at - b.at);
      if (!due.length) break;
      this.t = Math.max(this.t, due[0].at);
      due[0].run();
    }
    this.t = end;
  }
}

export class MemKV {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
