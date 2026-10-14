import { describe, expect, it } from "vitest";
import { OnlineClient } from "#lib/online/client.ts";
import { loadSession, saveSession } from "#lib/online/room.ts";
import type { PublicState } from "#lib/online/protocol.ts";
import { FakeTimers, FakeWS, MemKV } from "./online.helpers.ts";

const stateOf = (over: Partial<PublicState> = {}): PublicState => ({
  code: "ABCDEF", hostId: "me", phase: "lobby", round: 0, settings: null, timer: null, vote: null, seen: null, dealt: null, talk: null, twist: null, persona: null, question: null, reveal: null,
  players: [{ id: "me", name: "Ana", l: 0, score: 0, connected: true }], ...over
});

function rig(host: string | null = "party.example.dev", fetchBody: unknown = { code: "ABCDEF", ticket: "tk", expires: 99 }, fetchOk = true) {
  const timers = new FakeTimers();
  const sockets: FakeWS[] = [];
  const storage = new MemKV();
  const fetched: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    fetched.push({ url, init });
    if (!fetchOk) throw new Error("offline");
    return new Response(JSON.stringify(fetchBody), { status: 200 });
  }) as unknown as typeof fetch;
  const client = new OnlineClient({ host, fetchFn, storage, name: () => "Ana", now: () => timers.t, socket: { timers, pingMs: 10_000, factory: (u) => { const w = new FakeWS(u); sockets.push(w); return w; } } });
  return { client, sockets, timers, storage, fetched };
}

describe("OnlineClient: creating a room", () => {
  it("gets a code + ticket, connects to that room, sends create, and ends up logged in as host", async () => {
    const { client, sockets, fetched, storage } = rig();
    await client.create();
    expect(fetched[0].url).toBe("https://party.example.dev/api/new-code");
    expect(fetched[0].init?.method).toBe("POST");
    expect(sockets[0].url).toBe("wss://party.example.dev/parties/game/ABCDEF");
    expect(client.snapshot.status).toBe("connecting");
    sockets[0].open();
    expect(sockets[0].json()).toEqual([{ type: "create", nonce: expect.stringMatching(/^.{16,}$/), name: "Ana", ticket: "tk", expires: 99 }]);
    sockets[0].receive({ type: "created", code: "ABCDEF", playerId: "me", token: "tok", isHost: true });
    sockets[0].receive({ type: "state", rev: 1, state: stateOf() });
    expect(client.snapshot.status).toBe("in");
    expect(client.snapshot.code).toBe("ABCDEF");
    expect(client.isHost).toBe(true);
    expect(loadSession(storage)).toEqual({ code: "ABCDEF", playerId: "me", token: "tok" });
  });

  it("a failed code request shows an error and opens no socket", async () => {
    const { client, sockets } = rig("party.example.dev", {}, false);
    await client.create();
    expect(client.snapshot.status).toBe("closed");
    expect(client.snapshot.error).toBe("mpConnFail");
    expect(sockets).toHaveLength(0);
  });

  it("a malformed code response is refused", async () => {
    const { client, sockets } = rig("party.example.dev", { code: "bad", ticket: "t", expires: 1 });
    await client.create();
    expect(client.snapshot.status).toBe("closed");
    expect(sockets).toHaveLength(0);
  });

  it("without a configured server, online play is simply unavailable", async () => {
    const { client, sockets } = rig(null);
    expect(client.available).toBe(false);
    await client.create();
    expect(client.snapshot.status).toBe("closed");
    expect(sockets).toHaveLength(0);
    expect(client.resume()).toBe(false);
  });
});

describe("OnlineClient: joining", () => {
  it("rejects an invalid code without connecting", () => {
    const { client, sockets } = rig();
    client.join("ABC");
    expect(client.snapshot.status).toBe("closed");
    expect(client.snapshot.error).toBe("olBadCode");
    expect(sockets).toHaveLength(0);
  });

  it("sends join, and a fatal error closes the socket and names the reason", () => {
    const { client, sockets } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    expect(sockets[0].json()).toEqual([{ type: "join", nonce: expect.stringMatching(/^.{16,}$/), name: "Ana" }]);
    sockets[0].receive({ type: "error", code: "no-room", message: "x" });
    expect(client.snapshot.status).toBe("closed");
    expect(client.snapshot.error).toBe("errNoRoom");
    expect(sockets[0].closedWith?.code).toBe(1000);
  });

  it("a failed JOIN (no such room) keeps the seat saved for a different room", () => {
    const { client, sockets, storage } = rig();
    saveSession({ code: "ZZZZZZ", playerId: "old", token: "old" }, storage);
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "error", code: "no-room", message: "x" });
    expect(client.snapshot.status).toBe("closed");
    expect(loadSession(storage)).toEqual({ code: "ZZZZZZ", playerId: "old", token: "old" });
  });

  it("a REJOIN answered with no-room (the room ended) forgets the saved seat", () => {
    const { client, sockets, storage } = rig();
    saveSession({ code: "ABCDEF", playerId: "me", token: "t" }, storage);
    client.resume();
    sockets[0].open();
    expect(sockets[0].json()[0].type).toBe("rejoin");
    sockets[0].receive({ type: "error", code: "no-room", message: "x" });
    expect(client.snapshot.status).toBe("closed");
    expect(loadSession(storage)).toBeNull();
  });

  it("after the socket has given up (a long sleep), coming back to the app takes the saved seat again", () => {
    const { client, sockets, timers } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    for (let i = 0; i < 12; i++) {
      sockets[sockets.length - 1].drop();
      timers.advance(60_000);
    }
    expect(client.snapshot.status).toBe("closed");
    expect(client.snapshot.error).toBe("mpDisconnected");
    const before = sockets.length;
    client.nudge();
    expect(sockets).toHaveLength(before + 1);
    sockets[before].open();
    expect(sockets[before].json()).toEqual([{ type: "rejoin", playerId: "me", token: "t" }]);
    expect(client.snapshot.status).toBe("connecting");
  });

  it("a state update also clears a non-fatal error (a stale tap must not leave a message on screen for good)", () => {
    const { client, sockets } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: true });
    sockets[0].receive({ type: "error", code: "bad-phase", message: "x" });
    expect(client.snapshot.error).toBe("errBadPhase");
    sockets[0].receive({ type: "state", rev: 1, state: stateOf() });
    expect(client.snapshot.error).toBeNull();
  });
  it("a non-fatal error keeps the connection and is cleared by the next good message", () => {
    const { client, sockets } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    sockets[0].receive({ type: "error", code: "not-host", message: "x" });
    expect(client.snapshot.status).toBe("in");
    expect(client.snapshot.error).toBe("errNotHost");
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    expect(client.snapshot.error).toBeNull();
  });
});

describe("OnlineClient: state, roles and revisions", () => {
  async function inRoom() {
    const r = rig();
    r.client.join("ABCDEF");
    r.sockets[0].open();
    r.sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: true });
    return r;
  }

  it("ignores a state that is not newer", async () => {
    const { client, sockets } = await inRoom();
    sockets[0].receive({ type: "state", rev: 5, state: stateOf({ round: 5 }) });
    sockets[0].receive({ type: "state", rev: 4, state: stateOf({ round: 4 }) });
    sockets[0].receive({ type: "state", rev: 5, state: stateOf({ round: 9 }) });
    expect(client.snapshot.state?.round).toBe(5);
    expect(client.snapshot.rev).toBe(5);
  });

  it("keeps the role during a round, clears role and points when back in the lobby", async () => {
    const { client, sockets } = await inRoom();
    sockets[0].receive({ type: "role", role: { isIntruder: false, word: "pâine", category: "Mâncare", decoy: null, hint: "category", letter: null } });
    sockets[0].receive({ type: "state", rev: 1, state: stateOf({ phase: "round" }) });
    expect(client.snapshot.role?.word).toBe("pâine");
    sockets[0].receive({ type: "delta", delta: { me: 1 } });
    sockets[0].receive({ type: "state", rev: 2, state: stateOf({ phase: "scores" }) });
    expect(client.snapshot.delta).toEqual({ me: 1 });
    sockets[0].receive({ type: "state", rev: 3, state: stateOf({ phase: "lobby" }) });
    expect(client.snapshot.role).toBeNull();
    expect(client.snapshot.delta).toBeNull();
  });

  it("ignores garbage from the server", async () => {
    const { client, sockets } = await inRoom();
    sockets[0].receive("{nope");
    sockets[0].receive({ type: "mystery" });
    expect(client.snapshot.status).toBe("in");
  });

  it("send() reports whether the socket was open", async () => {
    const { client } = await inRoom();
    expect(client.send({ type: "vote-open" })).toBe(true);
    client.leave();
    expect(client.send({ type: "vote-open" })).toBe(false);
  });
});

describe("OnlineClient: dropped connections", () => {
  it("reconnects and takes the same seat back with rejoin", async () => {
    const { client, sockets, timers } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "secret", isHost: false });
    sockets[0].drop();
    expect(client.snapshot.status).toBe("reconnecting");
    timers.advance(timers.nextTimeoutDelay()!);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].json()).toEqual([{ type: "rejoin", playerId: "me", token: "secret" }]);
    sockets[1].receive({ type: "rejoined", code: "ABCDEF", playerId: "me", token: "secret", isHost: false });
    expect(client.snapshot.status).toBe("in");
  });

  it("a drop before the first answer repeats the login with the SAME nonce (so the server can find the seat it already made)", () => {
    const { client, sockets, timers } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    const first = sockets[0].json()[0] as { type: string; nonce: string };
    sockets[0].drop();
    timers.advance(timers.nextTimeoutDelay()!);
    sockets[1].open();
    const second = sockets[1].json()[0] as { type: string; nonce: string };
    expect(second.type).toBe("join");
    expect(second.nonce).toBe(first.nonce);
    client.join("ABCDEF"); // a new attempt is a new nonce
    sockets[sockets.length - 1].open();
    expect((sockets[sockets.length - 1].json()[0] as { nonce: string }).nonce).not.toBe(first.nonce);
  });

  it("if the seat is gone the client stops and forgets it", () => {
    const { client, sockets, timers, storage } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "secret", isHost: false });
    sockets[0].drop();
    timers.advance(timers.nextTimeoutDelay()!);
    sockets[1].open();
    sockets[1].receive({ type: "error", code: "bad-token", message: "x" });
    expect(client.snapshot.status).toBe("closed");
    expect(loadSession(storage)).toBeNull();
  });

  it("being replaced by a newer connection (4000) stops without retrying", () => {
    const { client, sockets, timers } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    sockets[0].drop(4000);
    expect(client.snapshot.status).toBe("closed");
    expect(client.snapshot.error).toBe("olReplaced");
    expect(timers.pending()).toBe(0);
  });

  it("nudge() reconnects immediately", () => {
    const { client, sockets } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].drop();
    client.nudge();
    expect(sockets).toHaveLength(2);
  });
});

describe("OnlineClient: resume and leave", () => {
  it("resume() reopens the saved room and rejoins", () => {
    const { client, sockets, storage } = rig();
    expect(client.resume()).toBe(false);
    saveSession({ code: "ABCDEF", playerId: "me", token: "tok" }, storage);
    expect(client.resume()).toBe(true);
    expect(sockets[0].url).toContain("/ABCDEF");
    sockets[0].open();
    expect(sockets[0].json()).toEqual([{ type: "rejoin", playerId: "me", token: "tok" }]);
  });

  it("leave() tells the server, forgets the seat and goes idle", () => {
    const { client, sockets, storage } = rig();
    client.join("ABCDEF");
    sockets[0].open();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    client.leave();
    expect(sockets[0].json().at(-1)).toEqual({ type: "leave" });
    expect(loadSession(storage)).toBeNull();
    expect(client.snapshot.status).toBe("idle");
  });

  it("subscribers hear about every change and can unsubscribe", () => {
    const { client, sockets } = rig();
    let n = 0;
    const off = client.subscribe(() => n++);
    client.join("ABCDEF");
    sockets[0].open();
    const heard = n;
    expect(heard).toBeGreaterThan(0);
    off();
    sockets[0].receive({ type: "joined", code: "ABCDEF", playerId: "me", token: "t", isHost: false });
    expect(n).toBe(heard);
  });
});
