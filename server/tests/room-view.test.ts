import { describe, expect, test } from "vitest";
import * as RL from "../room-logic.ts";
import { NOW, PACKS, SEC, ctx, everythingPublic, intruderIds, lobbyOf, modeLobby, roundOf, seqRng } from "./helpers.ts";

const state = (room: ReturnType<typeof lobbyOf>, now = NOW) => RL.publicState(room, now);

/** The host reveals first (the real flow), then picks the outcome. */
const resolve = (...args: Parameters<typeof RL.resolveOutcome>) => {
  if (args[0].current && !args[0].current.revealed) RL.revealRound(args[0], args[1]);
  return RL.resolveOutcome(...args);
};

describe("voting", () => {
  test("secret until everyone has voted, then the tally is public", () => {
    const { room } = roundOf(3);
    expect(() => RL.castVote(room, "host", "p1")).toThrow(/no vote/i);
    expect(() => RL.openVote(room, "p1")).toThrow(/host/i);
    RL.openVote(room, "host");
    RL.castVote(room, "host", "p1");
    expect(state(room).vote).toEqual({ revealed: false, voted: ["host"], picks: null, tally: null });
    expect(() => RL.castVote(room, "p1", "p1")).toThrow(/another player/i);
    RL.castVote(room, "p1", "host");
    RL.castVote(room, "host", "p2"); // changing a vote is fine before the reveal
    RL.castVote(room, "p2", "p1");
    const v = state(room).vote;
    expect(v?.revealed).toBe(true);
    expect(v?.tally).toEqual({ p2: 1, host: 1, p1: 1 });
    expect(() => RL.castVote(room, "p1", "p2")).toThrow(/already in/i);
    resolve(room, "host", "caught");
    expect(state(room).vote).toBeNull();
  });

  test("the host can show votes early, and a dropped player doesn't block the reveal", () => {
    const { room } = roundOf(4);
    RL.openVote(room, "host");
    RL.castVote(room, "host", "p1");
    RL.castVote(room, "p1", "p2");
    RL.castVote(room, "p2", "p3");
    expect(state(room).vote?.revealed).toBe(false);
    RL.disconnect(room, "p3", NOW);
    expect(state(room).vote?.revealed).toBe(true);

    const r2 = roundOf(3).room;
    RL.openVote(r2, "host");
    RL.castVote(r2, "p1", "host");
    RL.revealVote(r2, "host");
    expect(state(r2).vote?.tally).toEqual({ host: 1 });
  });

  test("bug A3: an open vote with no votes at all is never revealed by disconnects", () => {
    const { room } = roundOf(4);
    RL.openVote(room, "host");
    ["p1", "p2", "p3", "host"].forEach((id) => RL.disconnect(room, id, NOW));
    expect(state(room).vote?.revealed).toBe(false);
    RL.leaveRoom(room, "p1");
    expect(state(room).vote?.revealed).toBe(false);
    RL.revealVote(room, room.hostId ?? "host"); // the host can still force it
    expect(state(room).vote?.revealed).toBe(true);
  });
});

describe("what everyone may see", () => {
  test("publicState never leaks the word, the decoy, the intruders, tokens or internal flags", () => {
    const room = lobbyOf(4);
    RL.updateSettings(room, "host", { lang: "en", hint: "related" }, PACKS);
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx());
    RL.disconnect(room, "host", NOW);
    RL.sweep(room, NOW + RL.GRACE_MS); // creates a formerHostId
    RL.openVote(room, "p1");
    RL.castVote(room, "p1", "p2");
    const json = JSON.stringify(RL.publicState(room, NOW));
    const word = Object.values(roles).find((r) => r.word)?.word as string;
    const decoy = Object.values(roles).find((r) => r.decoy)?.decoy as string;
    expect(json.includes(word)).toBe(false);
    expect(json.includes(decoy)).toBe(false);
    for (const p of room.players) expect(json.includes(p.token)).toBe(false);
    for (const key of ["current", "imposterIds", "token", "formerHostId", "interimActed", "disconnectedAt", "left", "customWords", "isIntruder"]) {
      expect(json.includes(key)).toBe(false);
    }
  });

  test("the host's own words stay server-side", () => {
    const room = lobbyOf(3);
    RL.updateSettings(room, "host", { customWords: ["secretword1", "secretword2"], customName: "Mine" }, PACKS);
    expect(JSON.stringify(RL.publicState(room, NOW)).includes("secretword")).toBe(false);
    expect(room.customWords).toHaveLength(2);
  });

  test("roleFor restores the private role after a reconnect", () => {
    const { room, roles } = roundOf(4);
    expect(RL.roleFor(room, "p1")).toEqual(roles.p1);
    expect(RL.roleFor(room, "nobody")).toBeNull();
    resolve(room, "host", "caught");
    expect(RL.roleFor(room, "p1")).toBeNull();
  });
});

describe("display text is cleaned before anyone else sees it", () => {
  test("zero-width, bidi and control characters are removed from names", () => {
    const room = RL.createRoom("ABCDE", "host", "Ho\u200Bst\u202Eevil\u0007");
    expect(room.players[0].name).toBe("Hostevil");
    RL.joinRoom(room, "a", "\u2066An\u200Fa\u2069");
    expect(room.players[1].name).toBe("Ana");
  });

  test("a name made only of invisible characters falls back to the default", () => {
    const room = RL.createRoom("ABCDE", "host", "\u200B\u200B \u202E");
    expect(room.players[0].name).toBe("Host");
    RL.joinRoom(room, "a", "\u200B\u2060");
    expect(room.players[1].name).toBe("Player");
  });

  test("names are NFKC-normalised and whitespace is collapsed", () => {
    const room = RL.createRoom("ABCDE", "host", "  Ａｎａ \n\t  Maria\u2028 ");
    expect(room.players[0].name).toBe("Ana Maria");
  });

  test("a look-alike of an existing name (invisible char inside) is still made unique", () => {
    const room = RL.createRoom("ABCDE", "host", "Ana");
    RL.joinRoom(room, "a", "A\u200Bna");
    expect(room.players.map((p) => p.name)).toEqual(["Ana", "Ana (2)"]);
  });

  test("a name is cut by characters, never in the middle of an emoji", () => {
    const room = RL.createRoom("ABCDE", "host", "x".repeat(23) + "👨‍👩‍👧");
    const name = room.players[0].name;
    expect(Array.from(name).length <= 24).toBe(true);
    expect(/[\uD800-\uDBFF]$/.test(name)).toBe(false); // no lone high surrogate at the end
    expect(name.startsWith("x".repeat(23))).toBe(true);
  });

  test("emoji joined by a zero-width joiner and accented Romanian letters survive", () => {
    const room = RL.createRoom("ABCDE", "host", "Ștefan 👩‍🚀");
    expect(room.players[0].name).toBe("Ștefan 👩‍🚀");
  });

  test("custom words and the list name get the same cleaning (and are still de-duplicated)", () => {
    const room = lobbyOf(3);
    RL.updateSettings(room, "host", { customWords: ["pi\u200Bzza", "pizza", "  sup\u202Ea  ", "\u200B"], customName: "Lis\u200Bta" }, PACKS);
    expect(room.customWords).toEqual(["pizza", "supa"]);
    expect(room.settings?.customName).toBe("Lista");
  });
});

describe("the card, the shared wheel and the reveal", () => {
  const everything = (room: ReturnType<typeof lobbyOf>, now = NOW) => JSON.stringify(RL.publicState(room, now));

  test("the word and the intruders are NEVER in the public state during a round, until the host reveals", () => {
    const { room, roles } = roundOf(4);
    const word = roles.p1.word ?? roles.host.word ?? roles.p2.word ?? roles.p3.word;
    const intruder = intruderIds(roles)[0];
    expect(word).toBeTruthy();
    const check = () => {
      const s = RL.publicState(room, NOW);
      expect(s.reveal).toBeNull();
      expect(everything(room)).not.toContain(word as string);
      expect(everything(room)).not.toContain("imposterIds");
      expect(everything(room)).not.toContain("intruderIds");
    };
    check(); // right after the deal
    RL.markSeen(room, "p1");
    check();
    RL.startTalk(room, "host", ctx());
    check(); // the starter is public, the word is not
    RL.openVote(room, "host");
    RL.castVote(room, "host", "p1");
    check();
    RL.revealVote(room, "host");
    check(); // the vote tally is public, the word still is not
    expect(() => RL.revealRound(room, "p1")).toThrow(/Only the host/);
    check();
    RL.revealRound(room, "host");
    const r = RL.publicState(room, NOW).reveal;
    expect(r).toEqual({ intruderIds: [intruder], word, twin: null, troll: false, twist: null, agentId: null, word2: null, baseIntruders: 1 });
  });

  test("the reveal block is gone again once the round is scored, and in the lobby", () => {
    const { room } = roundOf(4);
    RL.revealRound(room, "host");
    expect(RL.publicState(room, NOW).reveal).not.toBeNull();
    resolve(room, "host", "caught");
    expect(RL.publicState(room, NOW).reveal).toBeNull();
    RL.nextRound(room, "host", NOW);
    expect(RL.publicState(room, NOW).reveal).toBeNull();
    expect(RL.publicState(room, NOW).talk).toBeNull();
    expect(RL.publicState(room, NOW).seen).toBeNull();
  });

  test("seen: only dealt-in players, once each, visible to everybody", () => {
    const { room } = roundOf(3);
    RL.markSeen(room, "p1");
    RL.markSeen(room, "p1");
    expect(RL.publicState(room, NOW).seen).toEqual(["p1"]);
    expect(() => RL.markSeen(room, "ghost")).toThrow(/not in this round/i);
    expect(() => RL.markSeen(lobbyOf(3), "p1")).toThrow(/No round/);
  });

  test("talk-start: host only, picks a dealt-in starter and a start time that every phone shares", () => {
    const { room } = roundOf(4);
    expect(() => RL.startTalk(room, "p1", ctx())).toThrow(/Only the host/);
    expect(RL.publicState(room, NOW).talk).toBeNull();
    expect(RL.publicState(room, NOW).timer).toBeNull(); // the timer waits for the discussion
    RL.startTalk(room, "host", ctx({ rng: seqRng([0.99]) }));
    const first = RL.publicState(room, NOW).talk;
    expect(first).toEqual({ starterId: "p3", sinceMs: -RL.TALK_LEAD_MS, wheel: true });
    // everyone computes the same wheel from the same start time, whenever the message reaches them
    expect(RL.publicState(room, NOW + 5000).talk).toEqual({ starterId: "p3", sinceMs: 5000 - RL.TALK_LEAD_MS, wheel: true });
    // a second tap changes nothing (same starter, same time)
    RL.startTalk(room, "host", ctx({ rng: seqRng([0]), now: NOW + 500 }));
    expect(RL.publicState(room, NOW).talk).toEqual(first);
  });

  test("talk-start starts the timer behind the wheel, so the wheel does not eat the talk time", () => {
    const { room } = roundOf(4, 3);
    RL.startTalk(room, "host", ctx());
    const timer = RL.publicState(room, NOW).timer;
    expect(timer).toEqual({ status: "running", remainingMs: RL.TALK_LEAD_MS + RL.WHEEL_TOTAL_MS + 3 * 60000 });
    const off = roundOf(4, 0).room;
    RL.startTalk(off, "host", ctx());
    expect(RL.publicState(off, NOW).timer).toBeNull();
  });

  test("reveal and talk-start need a round", () => {
    const room = lobbyOf(3);
    expect(() => RL.revealRound(room, "host")).toThrow(/No round/);
    expect(() => RL.startTalk(room, "host", ctx())).toThrow(/No round/);
  });
});

describe("nothing secret about the modes is public before the host reveals", () => {
  test("a round with every mode switched on", () => {
    for (const seed of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      const room = modeLobby(6, { tw: true, qm: true, troll: true, kn: true, cats: [], customWords: ["alfa|Litere|prima literă", "beta|Litere", "gama|Litere"] });
      const { roles } = RL.startRound(room, "host", { imposters: 2 }, ctx({ rng: seqRng([seed, 0.5, 0.35, 0.7]) }));
      RL.startTalk(room, "host", ctx());
      const json = everythingPublic(room);
      const word = Object.values(roles).find((r) => r.word)?.word;
      if (word) expect(json.includes(word)).toBe(false);
      for (const secret of ["prima literă", "word2", "agentId", "intruderIds", "baseIntruders", "mates", "customHint"]) expect(json.includes(secret)).toBe(false);
      expect(RL.publicState(room, NOW).reveal).toBeNull();
    }
  });
});

describe("who was dealt in, and the pause during the wheel", () => {
  test("a player who was away at the deal is not dealt in, does not get a role, and cannot be voted for or vote", () => {
    const room = lobbyOf(5);
    RL.disconnect(room, "p4", NOW);
    const { roles } = RL.startRound(room, "host", {}, ctx());
    expect(state(room).dealt).toEqual(["host", "p1", "p2", "p3"]);
    expect(roles.p4).toBeUndefined();
    RL.rejoinRoom(room, "p4", room.players.find((p) => p.id === "p4")!.token);
    expect(RL.roleFor(room, "p4")).toBeNull();
    RL.openVote(room, "host");
    expect(() => RL.castVote(room, "p4", "p1")).toThrow(/not in this round/);
    expect(() => RL.castVote(room, "p1", "p4")).toThrow(/another player/);
  });

  test("dealt is null outside a round", () => {
    const room = lobbyOf(3);
    expect(state(room).dealt).toBeNull();
  });

  test("the timer cannot be paused while the opening wheel is still turning, but can be afterwards", () => {
    const { room } = roundOf(4, 2);
    RL.startTalk(room, "host", ctx());
    const duringWheel = NOW + RL.TALK_LEAD_MS + 500;
    RL.timerAction(room, "host", "pause", duringWheel);
    expect(state(room, duringWheel).timer?.status).toBe("running");
    const afterWheel = NOW + RL.TALK_LEAD_MS + RL.WHEEL_TOTAL_MS + 1000;
    RL.timerAction(room, "host", "pause", afterWheel);
    expect(state(room, afterWheel).timer?.status).toBe("paused");
    expect(state(room, afterWheel).timer?.remainingMs).toBe(2 * 60 * SEC - 1000);
  });
});
