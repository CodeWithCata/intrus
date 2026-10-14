import { describe, expect, test } from "vitest";
import * as S from "../session.ts";
import { errorCode, Rig } from "./fakes.ts";

const SEC = 1000;

describe("logging in", () => {
  test("create needs a server-issued ticket; the creator becomes host", async () => {
    const rig = new Rig();
    const bad = rig.connect();
    await rig.send(bad, { type: "create", name: "X", ticket: "forged", expires: 1 });
    expect(errorCode(bad)).toBe("bad-ticket");
    expect(rig.session.room).toBeNull();
    const host = await rig.host1("Ana");
    const created = host.last("created")!;
    expect(created.isHost).toBe(true);
    expect(created.code).toBe("ABCDEF");
    expect(created.token.length).toBeGreaterThan(10);
    expect(host.last("state")?.state.players).toHaveLength(1);
  });

  test("a second create on the same code is refused", async () => {
    const rig = new Rig();
    await rig.host1();
    const other = rig.connect();
    await rig.send(other, { type: "create", name: "Z", ticket: "good", expires: 1 });
    expect(errorCode(other)).toBe("taken");
  });

  test("two creates at the same moment: only one wins", async () => {
    const rig = new Rig();
    const a = rig.connect();
    const b = rig.connect();
    await Promise.all([rig.send(a, { type: "create", name: "A", ticket: "good", expires: 1 }), rig.send(b, { type: "create", name: "B", ticket: "good", expires: 1 })]);
    expect([a, b].filter((c) => c.last("created")).length).toBe(1);
    expect([a, b].filter((c) => errorCode(c) === "taken").length).toBe(1);
  });

  test("join needs an existing room; a socket can't log in twice", async () => {
    const rig = new Rig();
    const early = rig.connect();
    await rig.send(early, { type: "join", name: "Early" });
    expect(errorCode(early)).toBe("no-room");
    await rig.host1();
    const g = await rig.guest("Bob");
    expect(g.last("joined")?.isHost).toBe(false);
    await rig.send(g, { type: "join", name: "Again" });
    expect(errorCode(g)).toBe("already-in-room");
    await rig.send(g, { type: "create", name: "Again", ticket: "good", expires: 1 });
    expect(errorCode(g)).toBe("already-in-room");
    expect(rig.session.room?.players).toHaveLength(2);
  });

  test("sockets that have not logged in get no room information", async () => {
    const rig = new Rig();
    await rig.host1();
    const lurker = rig.connect();
    const g = await rig.guest("Bob");
    await rig.send(g, { type: "settings", settings: { minutes: 2 } });
    expect(lurker.sent).toEqual([]);
  });
});

describe("the secret stays secret", () => {
  test("roles are private; no state message ever contains the word, decoy or a token", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(4);
    await rig.send(host, { type: "settings", settings: { lang: "en", hint: "related" } });
    await rig.send(host, { type: "start", imposters: 1 });
    const all = [host, ...guests];
    const roles = all.map((c) => c.last("role")!.role);
    expect(roles.every(Boolean)).toBe(true);
    const crew = roles.filter((r) => !r.isIntruder);
    const word = crew[0].word as string;
    const decoy = roles.find((r) => r.isIntruder)!.decoy as string;
    for (const c of all) {
      for (const raw of c.sent) {
        const m = JSON.parse(raw);
        if (m.type === "state") {
          expect(raw.includes(word)).toBe(false);
          expect(raw.includes(decoy)).toBe(false);
          expect(raw.includes("token")).toBe(false);
        }
      }
    }
    expect(roles.filter((r) => r.isIntruder)).toHaveLength(1);
  });

  test("a client cannot choose the word", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(3);
    await rig.send(host, { type: "start", imposters: 1, word: "HACK" });
    for (const c of [host, ...guests]) expect(JSON.stringify(c.last("role")).includes("HACK")).toBe(false);
  });

  test("only the host can start, and a rejected start sends no roles", async () => {
    const rig = new Rig();
    const { guests } = await rig.table(3);
    await rig.send(guests[0], { type: "start" });
    expect(errorCode(guests[0])).toBe("not-host");
    expect(guests[0].last("role")).toBeUndefined();
  });
});

describe("game modes and local-only settings", () => {
  test("the game modes reach the room as switches; groups and unknown fields never do", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    await rig.send(host, { type: "settings", settings: { minutes: 2, tw: true, qm: true, gid: "g1", twists: ["x"] } });
    const settings = rig.session.room?.settings;
    expect(Object.keys(settings ?? {}).sort()).toEqual(["cats", "customName", "hint", "imposters", "kn", "lang", "minutes", "qm", "troll", "tw", "twn", "wh"]);
    expect(settings?.tw).toBe(true);
    expect(settings?.qm).toBe(true);
    expect(JSON.stringify(rig.session.room).includes("gid")).toBe(false);
  });
});

describe("rev, ping and bad input", () => {
  test("rev never goes backwards, not even across a restart", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    const last = host.last("state")!.rev;
    rig.sockets.list = [];
    await rig.wake();
    const back = rig.connect();
    const { playerId, token } = host.last("created")!;
    await rig.send(back, { type: "rejoin", playerId, token });
    expect(back.last("state")!.rev).toBeGreaterThan(last);
  });

  test("rev rises with every broadcast", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    const revs = host.messages().filter((m) => m.type === "state").map((m) => (m as { rev: number }).rev);
    expect(revs.length).toBeGreaterThan(1);
    for (let i = 1; i < revs.length; i++) expect(revs[i]).toBeGreaterThan(revs[i - 1]);
  });

  test("ping is answered with pong", async () => {
    const rig = new Rig();
    const c = rig.connect();
    await rig.send(c, "ping");
    expect(c.sent).toEqual(["pong"]);
  });

  test("garbage, unknown types and oversize messages get an error, never a crash or a state change", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    const before = JSON.stringify(rig.session.room);
    for (const [msg, code] of [["{nope", "bad-json"], [{ type: "explode" }, "unknown-type"], [{ type: "vote" }, "bad-message"], ["x".repeat(20_000), "too-large"]] as const) {
      await rig.send(host, msg);
      expect(errorCode(host)).toBe(code);
    }
    expect(JSON.stringify(rig.session.room)).toBe(before);
  });
});

describe("dropping and coming back", () => {
  test("a dropped socket keeps the seat; rejoining restores it, and the role comes back", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(4);
    await rig.send(host, { type: "start", imposters: 1 });
    const g = guests[0];
    const { playerId, token } = g.last("joined")!;
    const roleBefore = g.last("role")!.role;
    await rig.close(g);
    expect(rig.session.room?.players.find((p) => p.id === playerId)?.connected).toBe(false);
    expect(host.last("state")?.state.players.find((p) => p.id === playerId)?.connected).toBe(false);
    const back = rig.connect();
    await rig.send(back, { type: "rejoin", playerId, token });
    expect(back.last("rejoined")?.playerId).toBe(playerId);
    expect(back.last("role")?.role).toEqual(roleBefore);
    expect(host.last("state")?.state.players.find((p) => p.id === playerId)?.connected).toBe(true);
  });

  test("a wrong token can't take a seat", async () => {
    const rig = new Rig();
    const { guests } = await rig.table(3);
    const { playerId } = guests[0].last("joined")!;
    const thief = rig.connect();
    await rig.send(thief, { type: "rejoin", playerId, token: "wrong" });
    expect(errorCode(thief)).toBe("bad-token");
    expect(thief.playerId).toBeNull();
  });

  test("rejoining on a new socket replaces the old one without marking the player offline", async () => {
    const rig = new Rig();
    const { guests } = await rig.table(3);
    const old = guests[0];
    const { playerId, token } = old.last("joined")!;
    const fresh = rig.connect();
    await rig.send(fresh, { type: "rejoin", playerId, token });
    expect(old.closed?.code).toBe(4000);
    await rig.session.onClose(old);
    expect(rig.session.room?.players.find((p) => p.id === playerId)?.connected).toBe(true);
  });

  test("lobby: the seat is freed only after the grace period, by the alarm", async () => {
    const rig = new Rig();
    const { guests } = await rig.table(3);
    const { playerId, token } = guests[0].last("joined")!;
    await rig.close(guests[0]);
    expect(rig.alarm).toBe(rig.clock + 45 * SEC);
    await rig.advance(44 * SEC);
    expect(rig.session.room?.players).toHaveLength(3);
    await rig.advance(1 * SEC);
    expect(rig.session.room?.players).toHaveLength(2);
    const late = rig.connect();
    await rig.send(late, { type: "rejoin", playerId, token });
    expect(errorCode(late)).toBe("bad-token");
  });

  test("the host drops: after the grace period the next player is host, and the old host can reclaim in a round", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(4);
    await rig.send(host, { type: "start", imposters: 1 });
    const { playerId, token } = host.last("created")!;
    await rig.close(host);
    await rig.advance(45 * SEC);
    const state = guests[0].last("state")!.state;
    expect(state.hostId).toBe(guests[0].playerId);
    const back = rig.connect();
    await rig.send(back, { type: "rejoin", playerId, token });
    expect(back.last("rejoined")?.isHost).toBe(true);
    expect(guests[0].last("state")?.state.hostId).toBe(playerId);
  });

  test("leave is immediate and permanent", async () => {
    const rig = new Rig();
    const { guests } = await rig.table(3);
    const { playerId, token } = guests[0].last("joined")!;
    await rig.send(guests[0], { type: "leave" });
    expect(rig.session.room?.players.some((p) => p.id === playerId)).toBe(false);
    const again = rig.connect();
    await rig.send(again, { type: "rejoin", playerId, token });
    expect(errorCode(again)).toBe("bad-token");
  });
});

describe("persistence and hibernation", () => {
  test("the room is saved before it is announced, and a fresh session restores it", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(4);
    await rig.send(host, { type: "start", imposters: 1 });
    const g = guests[0];
    const { playerId, token } = g.last("joined")!;
    const role = g.last("role")!.role;
    const revBefore = rig.session.rev;
    rig.sockets.list = []; // every socket is gone, as after a deploy
    await rig.wake();
    expect(rig.session.room?.phase).toBe("round");
    expect(rig.session.rev).toBe(revBefore);
    const back = rig.connect();
    await rig.send(back, { type: "rejoin", playerId, token });
    expect(back.last("rejoined")?.playerId).toBe(playerId);
    expect(back.last("role")?.role).toEqual(role);
  });

  test("storage holds the secret word, but only the server reads it", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    await rig.send(host, { type: "start" });
    expect(JSON.stringify([...rig.storage.data.values()]).includes('"word"')).toBe(true);
    expect(host.sent.some((s) => s.includes('"imposterIds"'))).toBe(false);
  });
});

describe("limits and abuse", () => {
  test("a socket that floods messages is told to slow down, then closed", async () => {
    const rig = new Rig();
    const c = rig.connect();
    for (let i = 0; i < S.RATE_CAPACITY + S.MAX_STRIKES + 2; i++) await rig.send(c, "ping");
    expect(c.sent.filter((s) => s === "pong")).toHaveLength(S.RATE_CAPACITY);
    expect(errorCode(c)).toBe("rate-limited");
    expect(c.closed?.code).toBe(1008);
  });

  test("the bucket refills over time", async () => {
    const rig = new Rig();
    const c = rig.connect();
    for (let i = 0; i < S.RATE_CAPACITY; i++) await rig.send(c, "ping");
    rig.clock += 2 * SEC;
    await rig.send(c, "ping");
    expect(c.sent.filter((s) => s === "pong")).toHaveLength(S.RATE_CAPACITY + 1);
  });

  test("too many sockets that never log in are refused", async () => {
    const rig = new Rig();
    const conns = Array.from({ length: S.MAX_UNAUTH + 2 }, () => rig.connect());
    expect(conns.filter((c) => c.closed?.code === 1013)).toHaveLength(2); // the 7th and 8th
  });

  test("sockets that never log in are closed by the alarm", async () => {
    const rig = new Rig();
    const c = rig.connect();
    await rig.send(c, "ping"); // lets the queued alarm scheduling finish
    await rig.advance(S.UNAUTH_TIMEOUT_MS + 1);
    expect(c.closed?.code).toBe(1008);
  });

  test("the whole room is capped", async () => {
    const rig = new Rig();
    await rig.host1();
    const conns = [];
    for (let i = 0; i < S.MAX_SOCKETS + 3; i++) conns.push(await rig.guest("G" + i));
    expect(rig.sockets.list.length).toBeLessThan(S.MAX_SOCKETS + 3);
  });
});

describe("idle rooms", () => {
  test("a room with no sockets is deleted after the idle period, and not before", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(3);
    for (const c of [host, ...guests]) await rig.close(c);
    expect(rig.session.room).not.toBeNull();
    await rig.advance(S.IDLE_MS - 60 * SEC);
    expect(rig.session.room).not.toBeNull();
    await rig.advance(61 * SEC + 45 * SEC);
    await rig.advance(S.IDLE_MS);
    expect(rig.session.room).toBeNull();
    expect(rig.storage.data.size).toBe(0);
  });

  test("the alarm is only rewritten when it changes", async () => {
    const rig = new Rig();
    const { host } = await rig.table(3);
    const before = rig.alarmSets;
    for (let i = 0; i < 5; i++) await rig.send(host, { type: "settings", settings: { minutes: 2 } });
    expect(rig.alarmSets).toBe(before);
  });
});

describe("a full game over the wire", () => {
  test("settings, round, vote, timer, outcome, next round", async () => {
    const rig = new Rig();
    const { host, guests } = await rig.table(4);
    await rig.send(host, { type: "settings", settings: { minutes: 2, customWords: ["alfa", "beta"], customName: "Mine" } });
    await rig.send(host, { type: "start", imposters: 1 });
    await rig.send(host, { type: "timer", action: "start" });
    expect(host.last("state")?.state.timer?.status).toBe("running");
    await rig.send(host, { type: "vote-open" });
    const ids = [host, ...guests].map((c) => c.playerId!);
    for (const c of [host, ...guests]) await rig.send(c, { type: "vote", suspectId: ids.find((i) => i !== c.playerId)! });
    expect(host.last("state")?.state.vote?.revealed).toBe(true);
    await rig.send(host, { type: "outcome", kind: "caught" });
    expect(errorCode(host)).toBe("not-revealed"); // the intruders have not been shown yet
    await rig.send(host, { type: "reveal" });
    await rig.send(host, { type: "outcome", kind: "caught" });
    expect(host.last("delta")).toBeTruthy();
    expect(guests[0].last("delta")).toBeUndefined();
    expect(host.last("state")?.state.phase).toBe("scores");
    await rig.send(host, { type: "next-round" });
    expect(host.last("state")?.state.phase).toBe("lobby");
  });
});

describe("saving", () => {
  test("a failed save puts the room back to what was stored and tells nobody about the change", async () => {
    const rig = new Rig();
    const host = await rig.host1("Ana");
    const saved = structuredClone(rig.storage.data.get("room"));
    const guest = rig.connect();
    const put = rig.storage.put.bind(rig.storage);
    rig.storage.put = async () => {
      throw new Error("disk full");
    };
    await rig.send(guest, { type: "join", name: "Bo" });
    rig.storage.put = put;
    expect(rig.session.room?.players).toHaveLength(1);
    expect(guest.last("joined")).toBeUndefined();
    expect(rig.storage.data.get("room")).toEqual(saved);
    await rig.send(rig.connect(), { type: "join", name: "Cy" }); // the room still works afterwards
    expect(rig.session.room?.players).toHaveLength(2);
    expect(host.last("state")?.state.players).toHaveLength(2);
  });

  test("the saved room carries a version; a room saved by a newer version is dropped", async () => {
    const rig = new Rig();
    await rig.host1();
    const saved = rig.storage.data.get("room") as { v: number };
    expect(saved.v).toBe(1);
    rig.storage.data.set("room", { ...saved, v: 99 });
    await rig.wake();
    expect(rig.session.room).toBeNull();
  });

  test("a room saved before versioning still loads", async () => {
    const rig = new Rig();
    await rig.host1("Ana");
    const { v: _v, ...old } = rig.storage.data.get("room") as { v: number };
    rig.storage.data.set("room", old);
    await rig.wake();
    expect(rig.session.room?.players).toHaveLength(1);
  });
});

describe("a login sent twice (reconnect before the first answer)", () => {
  const nonce = "n".repeat(20);

  test("a repeated join with the same nonce gets the same seat, not a second one", async () => {
    const rig = new Rig();
    await rig.host1();
    const first = rig.connect();
    await rig.send(first, { type: "join", nonce, name: "Bo" });
    const seat = first.last("joined")!;
    await rig.close(first);
    const again = rig.connect();
    await rig.send(again, { type: "join", nonce, name: "Bo" });
    expect(again.last("joined")?.playerId).toBe(seat.playerId);
    expect(again.last("joined")?.token).toBe(seat.token);
    expect(rig.session.room?.players).toHaveLength(2);
  });

  test("a repeated create with the same nonce is acknowledged again, not refused as taken", async () => {
    const rig = new Rig();
    const a = rig.connect();
    await rig.send(a, { type: "create", nonce, name: "Ana", ticket: "good", expires: 1 });
    const seat = a.last("created")!;
    await rig.close(a);
    const b = rig.connect();
    await rig.send(b, { type: "create", nonce, name: "Ana", ticket: "good", expires: 1 });
    expect(errorCode(b)).toBeUndefined();
    expect(b.last("created")?.playerId).toBe(seat.playerId);
    expect(b.last("created")?.isHost).toBe(true);
  });

  test("a different nonce is a different player, and a nonce never leaks into the public state", async () => {
    const rig = new Rig();
    const host = await rig.host1();
    await rig.send(rig.connect(), { type: "join", nonce, name: "Bo" });
    await rig.send(rig.connect(), { type: "join", nonce: "m".repeat(20), name: "Cy" });
    expect(rig.session.room?.players).toHaveLength(3);
    expect(JSON.stringify(host.last("state"))).not.toContain(nonce);
  });
});
