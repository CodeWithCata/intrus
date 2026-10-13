import { describe, expect, it } from "vitest";
import { ReconnectingSocket } from "#lib/online/socket.ts";
import { FakeTimers, FakeWS } from "./online.helpers.ts";

function rig(opts: { maxAttempts?: number; pingMs?: number } = {}) {
  const timers = new FakeTimers();
  const sockets: FakeWS[] = [];
  const log: string[] = [];
  const closes: { code: number; willRetry: boolean }[] = [];
  const s = new ReconnectingSocket(
    () => "wss://x/room",
    { onOpen: () => log.push("open"), onMessage: (t) => log.push("msg:" + t), onClose: (i) => closes.push(i) },
    { timers, pingMs: opts.pingMs ?? 1000, maxAttempts: opts.maxAttempts, factory: (u) => { const w = new FakeWS(u); sockets.push(w); return w; } }
  );
  return { s, timers, sockets, log, closes };
}

describe("ReconnectingSocket", () => {
  it("connects, delivers messages, swallows pongs, sends only when open", () => {
    const { s, sockets, log } = rig();
    expect(s.send("x")).toBe(false);
    s.connect();
    expect(s.send("x")).toBe(false); // still connecting
    sockets[0].open();
    expect(s.send("hello")).toBe(true);
    expect(sockets[0].sent).toEqual(["hello"]);
    sockets[0].receive("pong");
    sockets[0].receive("data");
    expect(log).toEqual(["open", "msg:data"]);
  });

  it("reconnects after a drop with a growing delay, and resets the delay after a successful open", () => {
    const { s, sockets, timers, closes } = rig();
    s.connect();
    sockets[0].open();
    sockets[0].drop();
    expect(closes[0]).toEqual({ code: 1006, willRetry: true });
    const d1 = timers.nextTimeoutDelay()!;
    timers.advance(d1);
    expect(sockets).toHaveLength(2);
    sockets[1].drop(); // never opened: attempts keep counting
    const d2 = timers.nextTimeoutDelay()!;
    expect(d2).toBeGreaterThan(d1);
    timers.advance(d2);
    sockets[2].open();
    sockets[2].drop();
    expect(timers.nextTimeoutDelay()).toBe(d1); // reset after the successful open
  });

  it("policy closes (rate limit / busy) wait at least 5 seconds", () => {
    const { s, sockets, timers } = rig();
    s.connect();
    sockets[0].open();
    sockets[0].drop(1008);
    expect(timers.nextTimeoutDelay()!).toBeGreaterThan(4999);
  });

  it("stops for good on a no-retry code (replaced by a newer connection)", () => {
    const { s, sockets, timers, closes } = rig();
    s.connect();
    sockets[0].open();
    sockets[0].drop(4000);
    expect(closes).toEqual([{ code: 4000, willRetry: false }]);
    expect(timers.pending()).toBe(0);
    s.connect();
    expect(sockets).toHaveLength(1);
  });

  it("gives up after maxAttempts", () => {
    const { s, sockets, timers, closes } = rig({ maxAttempts: 2 });
    s.connect();
    for (let i = 0; i < 3; i++) {
      sockets[i].drop();
      if (i < 2) timers.advance(timers.nextTimeoutDelay()!);
    }
    expect(closes.map((c) => c.willRetry)).toEqual([true, true, false]);
  });

  it("close() is final: no retry, no events", () => {
    const { s, sockets, timers, closes } = rig();
    s.connect();
    sockets[0].open();
    s.close();
    expect(sockets[0].closedWith?.code).toBe(1000);
    sockets[0].drop();
    timers.advance(60_000);
    expect(closes).toEqual([]);
    expect(sockets).toHaveLength(1);
  });

  it("nudge() reconnects at once when waiting to retry", () => {
    const { s, sockets } = rig();
    s.connect();
    sockets[0].open();
    sockets[0].drop();
    s.nudge();
    expect(sockets).toHaveLength(2);
  });

  it("sends a ping every interval, and closes a connection that has gone silent", () => {
    const { s, sockets, timers, closes } = rig({ pingMs: 1000 });
    s.connect();
    sockets[0].open();
    timers.advance(1000);
    expect(sockets[0].sent).toEqual(["ping"]);
    sockets[0].receive("pong");
    timers.advance(1000);
    expect(sockets[0].sent).toEqual(["ping", "ping"]);
    timers.advance(3000); // no pong for > 2.2 intervals
    expect(sockets[0].closedWith?.code).toBe(4001);
    sockets[0].drop(4001);
    expect(closes.at(-1)).toEqual({ code: 4001, willRetry: true });
  });

  it("nudge() on an open socket pings it, and reconnects at once if nothing at all comes back", () => {
    const { s, sockets, timers, closes } = rig({ pingMs: 100_000 });
    s.connect();
    sockets[0].open();
    timers.advance(10_000); // the phone slept: nothing was heard since the open
    s.nudge();
    expect(sockets[0].sent).toEqual(["ping"]);
    timers.advance(3000);
    expect(sockets[0].closedWith?.code).toBe(4001);
    expect(closes.at(-1)).toEqual({ code: 4001, willRetry: true });
    timers.advance(1000);
    expect(sockets).toHaveLength(2); // the retry did not wait for the browser to report the close
  });

  it("nudge() on a healthy socket (anything arrives) keeps it", () => {
    const { s, sockets, timers } = rig({ pingMs: 100_000 });
    s.connect();
    sockets[0].open();
    timers.advance(10_000);
    s.nudge();
    timers.advance(500);
    sockets[0].receive("pong");
    timers.advance(5000);
    expect(sockets[0].closedWith).toBeNull();
    expect(sockets).toHaveLength(1);
  });
});
