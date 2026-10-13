import { isLookCode } from "../../src/lib/components/players/avatar-parts.ts";
import { describe, expect, test } from "vitest";
import * as RL from "../room-logic.ts";
import { NOW, PACKS, SEC, ctx, lobbyOf, roundOf } from "./helpers.ts";

/** The host reveals first (the real flow), then picks the outcome. */
const resolve = (...args: Parameters<typeof RL.resolveOutcome>) => {
  if (args[0].current && !args[0].current.revealed) RL.revealRound(args[0], args[1]);
  return RL.resolveOutcome(...args);
};

describe("joining and host-only actions", () => {
  test("create + join: unique names, phase, host is first player", () => {
    const room = RL.createRoom("ABCDE", "host", "Ana");
    expect(room.phase).toBe("lobby");
    expect(room.hostId).toBe("host");
    RL.joinRoom(room, "a", "ana");
    RL.joinRoom(room, "b", "Ana");
    expect(room.players.map((p) => p.name)).toEqual(["Ana", "ana (2)", "Ana (3)"]);
  });

  test("join is idempotent, rejects mid-game and a full room", () => {
    const room = lobbyOf(3);
    RL.joinRoom(room, "p1", "Player 1");
    expect(room.players).toHaveLength(3);
    room.phase = "round";
    expect(() => RL.joinRoom(room, "late", "Late")).toThrow(/already started/);
    room.phase = "lobby";
    for (let i = room.players.length; i < RL.MAX_PLAYERS; i++) RL.joinRoom(room, "x" + i, "X" + i);
    expect(() => RL.joinRoom(room, "overflow", "Overflow")).toThrow(/full/);
  });

  test("only the host can start, change settings, resolve, or advance", () => {
    const room = lobbyOf(4);
    expect(() => RL.startRound(room, "p1", {}, ctx())).toThrow(/Only the host/);
    expect(() => RL.updateSettings(room, "p1", {}, PACKS)).toThrow(/Only the host/);
    RL.startRound(room, "host", {}, ctx());
    expect(() => resolve(room, "p1", "caught")).toThrow(/Only the host/);
  });

  test("avatars: a valid look code is kept, a missing or invalid one falls back to a free default", () => {
    const room = RL.createRoom("ABCDE", "host", "Host", 4097);
    RL.joinRoom(room, "a", "A", 4097); // twins are allowed, like in the local game
    RL.joinRoom(room, "b", "B", "<script>"); // not a number
    RL.joinRoom(room, "c", "C", 268435456); // above LOOK_MAX
    RL.joinRoom(room, "d", "D", 7); // hat 7 does not exist
    RL.joinRoom(room, "e", "E", 5);
    const l = room.players.map((p) => p.l);
    expect(l[0]).toBe(4097);
    expect(l[1]).toBe(4097);
    expect(l[5]).toBe(5);
    expect(new Set([l[2], l[3], l[4]]).size).toBe(3); // each fallback is a free default
    l.forEach((x) => expect(isLookCode(x)).toBe(true));
  });

  test("avatars: a player can change their own look, an invalid one changes nothing, and rejoin carries the newest", () => {
    const room = RL.createRoom("ABCDE", "host", "Host");
    RL.joinRoom(room, "a", "A");
    RL.setLook(room, "a", 1234);
    expect(room.players[1].l).toBe(1234);
    expect(() => RL.setLook(room, "a", 1.5)).toThrow(/valid/);
    expect(() => RL.setLook(room, "a", 7)).toThrow(/valid/);
    expect(() => RL.setLook(room, "ghost", 1)).toThrow(/not in this room/i);
    expect(room.players[1].l).toBe(1234);
    RL.disconnect(room, "a", 1000);
    expect(RL.rejoinRoom(room, "a", room.players[1].token, 99)).toBe(true);
    expect(room.players[1].l).toBe(99);
    expect(RL.rejoinRoom(room, "a", room.players[1].token, "nope")).toBe(true);
    expect(room.players[1].l).toBe(99);
  });

  test("avatars: publicState carries `l` and never an emoji or a photo", () => {
    const room = RL.createRoom("ABCDE", "host", "Host", 4097);
    const p = RL.publicState(room, 0).players[0] as Record<string, unknown>;
    expect(p.l).toBe(4097);
    expect("emoji" in p).toBe(false);
    expect("ph" in p).toBe(false);
  });

  test("randomCode uses an unambiguous alphabet (no 0/O/1/I) and the requested length", () => {
    for (let i = 0; i < 200; i++) {
      const code = RL.randomCode(Math.random, 6);
      expect(code).toHaveLength(6);
      expect(/[01OI]/.test(code)).toBe(false);
    }
  });
});

describe("leaving on purpose", () => {
  test("lobby: removes the player. Mid-round: marks them gone but keeps the score", () => {
    const room = lobbyOf(4);
    RL.leaveRoom(room, "p1");
    expect(room.players).toHaveLength(3);
    RL.startRound(room, "host", {}, ctx());
    RL.leaveRoom(room, "p2");
    const p2 = room.players.find((p) => p.id === "p2")!;
    expect(p2.connected).toBe(false);
    expect(p2.left).toBe(true);
    expect(room.players).toHaveLength(3);
  });

  test("the host leaving promotes the next connected player at once, or clears hostId if none remain", () => {
    const room = lobbyOf(3);
    expect(RL.leaveRoom(room, "host")).toBe("p1");
    expect(room.hostId).toBe("p1");
    expect(room.formerHostId).toBeNull();
    RL.leaveRoom(room, "p1");
    RL.leaveRoom(room, "p2");
    expect(room.hostId).toBeNull();
  });

  test("someone who left on purpose can't come back with their token", () => {
    const { room } = roundOf(4);
    const token = RL.tokenOf(room, "p1")!;
    RL.leaveRoom(room, "p1");
    expect(RL.rejoinRoom(room, "p1", token)).toBe(false);
  });

  test("play again: someone who left is removed, doesn't get a role, and can't score", () => {
    const { room } = roundOf(5);
    resolve(room, "host", "caught");
    RL.leaveRoom(room, "p4");
    const { roles } = RL.startRound(room, "host", {}, ctx());
    expect(room.players).toHaveLength(4);
    expect("p4" in roles).toBe(false);
  });

  test("back to lobby: seats of people who left are cleared", () => {
    const { room } = roundOf(4);
    resolve(room, "host", "caught");
    RL.leaveRoom(room, "p3");
    RL.nextRound(room, "host", NOW);
    expect(room.phase).toBe("lobby");
    expect(room.players.some((p) => p.id === "p3")).toBe(false);
  });
});

describe("dropped connections and the grace period (Step B)", () => {
  test("a dropped player keeps their seat in the lobby until the grace period is over", () => {
    const room = lobbyOf(4);
    RL.disconnect(room, "p1", NOW);
    expect(room.players).toHaveLength(4);
    expect(RL.sweep(room, NOW + RL.GRACE_MS - 1).removed).toEqual([]);
    expect(room.players).toHaveLength(4);
    expect(RL.sweep(room, NOW + RL.GRACE_MS).removed).toEqual(["p1"]);
    expect(room.players).toHaveLength(3);
  });

  test("rejoining inside the grace period restores the seat, the score and the token stays valid", () => {
    const room = lobbyOf(4);
    room.players[1].score = 5;
    const token = RL.tokenOf(room, "p1")!;
    RL.disconnect(room, "p1", NOW);
    expect(RL.rejoinRoom(room, "p1", token)).toBe(true);
    const p1 = room.players[1];
    expect(p1.connected).toBe(true);
    expect(p1.disconnectedAt).toBeNull();
    expect(p1.score).toBe(5);
    RL.sweep(room, NOW + 10 * 60 * SEC);
    expect(room.players).toHaveLength(4);
  });

  test("rejoining with a wrong token, an unknown seat, or after removal fails", () => {
    const room = lobbyOf(4);
    const token = RL.tokenOf(room, "p1")!;
    RL.disconnect(room, "p1", NOW);
    expect(RL.rejoinRoom(room, "p1", "wrong")).toBe(false);
    expect(RL.rejoinRoom(room, "nobody", token)).toBe(false);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(RL.rejoinRoom(room, "p1", token)).toBe(false);
  });

  test("the host seat is held during the grace period, then the next connected player takes over", () => {
    const room = lobbyOf(4);
    RL.disconnect(room, "host", NOW);
    expect(RL.sweep(room, NOW + RL.GRACE_MS - 1).hostChanged).toBe(false);
    expect(room.hostId).toBe("host");
    expect(RL.sweep(room, NOW + RL.GRACE_MS).hostChanged).toBe(true);
    expect(room.hostId).toBe("p1");
    const { room: inRound } = roundOf(4); // seats are kept in a round, so the displaced host is remembered
    RL.disconnect(inRound, "host", NOW);
    RL.sweep(inRound, NOW + RL.GRACE_MS);
    expect(inRound.hostId).toBe("p1");
    expect(inRound.formerHostId).toBe("host");
  });

  test("if nobody else is connected the host seat is simply held", () => {
    const room = lobbyOf(3);
    ["host", "p1", "p2"].forEach((id) => RL.disconnect(room, id, NOW));
    RL.sweep(room, NOW + RL.GRACE_MS * 10);
    expect(room.hostId).toBe("host");
    expect(room.players.map((p) => p.id)).toEqual(["host"]); // the expired non-hosts are gone, the host seat stays
    expect(RL.rejoinRoom(room, "host", RL.tokenOf(room, "host")!)).toBe(true);
  });

  test("host reclaim: in a round the old host gets the role back if the interim host did nothing", () => {
    const { room } = roundOf(4);
    const token = RL.tokenOf(room, "host")!;
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(room.hostId).toBe("p1");
    expect(RL.rejoinRoom(room, "host", token)).toBe(true);
    expect(room.hostId).toBe("host");
    expect(room.formerHostId).toBeNull();
  });

  test("host reclaim ends as soon as the interim host does a host action", () => {
    const { room } = roundOf(4);
    const token = RL.tokenOf(room, "host")!;
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS);
    RL.openVote(room, "p1"); // the interim host acts
    expect(RL.rejoinRoom(room, "host", token)).toBe(true); // still welcome back as a player...
    expect(room.hostId).toBe("p1"); // ...but not as host
    expect(room.formerHostId).toBeNull();
  });

  test("a failed host action does not end the claim", () => {
    const { room } = roundOf(4);
    const token = RL.tokenOf(room, "host")!;
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(() => RL.revealVote(room, "p1")).toThrow(/no vote/i);
    expect(() => RL.resolveOutcome(room, "p1", "nonsense")).toThrow();
    RL.rejoinRoom(room, "host", token);
    expect(room.hostId).toBe("host");
  });

  test("two hosts in a row timing out: the first one can still reclaim while nobody acted", () => {
    const { room } = roundOf(5);
    const token = RL.tokenOf(room, "host")!;
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(room.hostId).toBe("p1");
    RL.disconnect(room, "p1", NOW + RL.GRACE_MS);
    RL.sweep(room, NOW + 2 * RL.GRACE_MS);
    expect(room.hostId).toBe("p2");
    expect(room.formerHostId).toBe("host");
    RL.rejoinRoom(room, "host", token);
    expect(room.hostId).toBe("host");
  });

  test("in the lobby the claim lasts exactly as long as the seat: after the grace period they must join again", () => {
    const room = lobbyOf(4);
    const token = RL.tokenOf(room, "host")!;
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(room.hostId).toBe("p1");
    expect(room.players.some((p) => p.id === "host")).toBe(false);
    expect(room.formerHostId).toBeNull();
    expect(RL.rejoinRoom(room, "host", token)).toBe(false);
  });

  test("a disconnected player is not dealt in, keeps their seat, and can come back as a spectator", () => {
    const room = lobbyOf(5);
    const token = RL.tokenOf(room, "p4")!;
    RL.disconnect(room, "p4", NOW);
    const { roles } = RL.startRound(room, "host", {}, ctx({ now: NOW + 5 * SEC }));
    expect("p4" in roles).toBe(false);
    expect(room.players.some((p) => p.id === "p4")).toBe(true);
    expect(RL.rejoinRoom(room, "p4", token)).toBe(true);
    expect(RL.roleFor(room, "p4")).toBeNull();
    const { delta } = resolve(room, "host", "caught");
    expect(delta.p4).toBe(0);
  });

  test("during a round nobody is removed, however long they are gone", () => {
    const { room } = roundOf(4);
    RL.disconnect(room, "p3", NOW);
    expect(RL.sweep(room, NOW + 60 * 60 * SEC).removed).toEqual([]);
    expect(room.players).toHaveLength(4);
  });

  test("nextSweepAt tells the caller when to wake up", () => {
    const room = lobbyOf(4);
    expect(RL.nextSweepAt(room)).toBeNull();
    RL.disconnect(room, "p2", NOW + 5 * SEC);
    RL.disconnect(room, "p1", NOW);
    expect(RL.nextSweepAt(room)).toBe(NOW + RL.GRACE_MS);
    RL.sweep(room, NOW + RL.GRACE_MS);
    expect(RL.nextSweepAt(room)).toBe(NOW + 5 * SEC + RL.GRACE_MS);
    RL.sweep(room, NOW + 5 * SEC + RL.GRACE_MS);
    expect(RL.nextSweepAt(room)).toBeNull();
  });

  test("nextSweepAt in a round only cares about the host", () => {
    const { room } = roundOf(4);
    RL.disconnect(room, "p2", NOW);
    expect(RL.nextSweepAt(room)).toBeNull();
    RL.disconnect(room, "host", NOW + SEC);
    expect(RL.nextSweepAt(room)).toBe(NOW + SEC + RL.GRACE_MS);
  });
});
