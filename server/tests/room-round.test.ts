import { describe, expect, test } from "vitest";
import * as RL from "../room-logic.ts";
import type { StartOptions } from "../types.ts";
import { NOW, PACKS, SEC, ctx, intruderIds, lobbyOf, modeLobby, roundOf, seqRng } from "./helpers.ts";

const state = (room: ReturnType<typeof lobbyOf>, now = NOW) => RL.publicState(room, now);

/** The host reveals first (the real flow), then picks the outcome. */
const resolve = (...args: Parameters<typeof RL.resolveOutcome>) => {
  if (args[0].current && !args[0].current.revealed) RL.revealRound(args[0], args[1]);
  return RL.resolveOutcome(...args);
};

describe("starting a round", () => {
  test("needs enough players and a word", () => {
    const two = RL.joinRoom(RL.createRoom("C", "host", "H"), "p1", "P1");
    expect(() => RL.startRound(two, "host", { imposters: 1 }, ctx())).toThrow(/Need at least/);
    const room = lobbyOf(3);
    room.settings = { cats: ["nope"], imposters: 1, minutes: 3, hint: "category", lang: "en", customName: "", tw: false, qm: false, troll: false, twn: false, kn: false };
    expect(() => RL.startRound(room, "host", { imposters: 1 }, ctx({ packs: [] }))).toThrow(/No words/);
  });

  test("caps imposters the same way the single-device game does", () => {
    const room = lobbyOf(5); // maxImposters(5) = 2
    const { roles } = RL.startRound(room, "host", { imposters: 99 }, ctx());
    expect(intruderIds(roles)).toHaveLength(2);
  });

  test("the server picks the word: crew get it and the category, intruders (hint: related) get only the decoy", () => {
    const room = lobbyOf(4);
    RL.updateSettings(room, "host", { lang: "en", hint: "related" }, PACKS);
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx());
    const all = Object.values(roles);
    const intruders = all.filter((r) => r.isIntruder);
    const crew = all.filter((r) => !r.isIntruder);
    expect(intruders).toHaveLength(1);
    expect(crew).toHaveLength(3);
    const word = crew[0].word as string;
    expect(PACKS.flatMap((p) => p.words.en)).toContain(word);
    crew.forEach((r) => expect(r.word).toBe(word));
    intruders.forEach((r) => {
      expect(r.word).toBeNull();
      expect(r.decoy).not.toBeNull();
      expect(r.decoy).not.toBe(word);
    });
    crew.forEach((r) => expect(r.category).not.toBeNull());
    intruders.forEach((r) => expect(r.category).toBeNull());
  });

  test.each([
    ["category", { category: true, decoy: false, letter: false }],
    ["related", { category: false, decoy: true, letter: false }],
    ["letter", { category: false, decoy: false, letter: true }],
    ["none", { category: false, decoy: false, letter: false }]
  ] as const)("an intruder learns only what hint mode %s promises", (hint, expected) => {
    const room = lobbyOf(4);
    RL.updateSettings(room, "host", { lang: "en", hint }, PACKS);
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx());
    const intruder = Object.values(roles).find((r) => r.isIntruder)!;
    expect(intruder.category !== null).toBe(expected.category);
    expect(intruder.decoy !== null).toBe(expected.decoy);
    expect(intruder.letter !== null).toBe(expected.letter);
    Object.values(roles).filter((r) => !r.isIntruder).forEach((r) => expect(r.category).not.toBeNull());
  });

  test("a client cannot choose the word (extra fields are ignored)", () => {
    const room = lobbyOf(4);
    const evil = { imposters: 1, word: "HACK", category: "HACK", decoy: "HACK" } as unknown as StartOptions;
    const { roles } = RL.startRound(room, "host", evil, ctx());
    Object.values(roles).forEach((r) => {
      expect(r.word).not.toBe("HACK");
      expect(r.category).not.toBe("HACK");
      expect(r.decoy).not.toBe("HACK");
    });
  });

  test("fairness: last round's intruder is less likely next round, but can still be picked (nobody can be ruled out)", () => {
    // rng order inside startRound: word, decoy, then one value per intruder. Low value = the first (weighted-down) candidate.
    const again = lobbyOf(5);
    const first = intruderIds(RL.startRound(again, "host", { imposters: 1 }, ctx({ rng: seqRng([0.9, 0.9, 0]) })).roles)[0];
    resolve(again, "host", "caught");
    RL.nextRound(again, "host", NOW);
    // "host" (index 0) was the intruder; its weight is now 1/3 of 4.33 in total, so values below ~0.077 still land on it
    expect(first).toBe("host");
    expect(intruderIds(RL.startRound(again, "host", { imposters: 1 }, ctx({ rng: seqRng([0.9, 0.9, 0.05]) })).roles)[0]).toBe("host");

    const other = lobbyOf(5);
    RL.startRound(other, "host", { imposters: 1 }, ctx({ rng: seqRng([0.9, 0.9, 0]) }));
    resolve(other, "host", "caught");
    RL.nextRound(other, "host", NOW);
    expect(intruderIds(RL.startRound(other, "host", { imposters: 1 }, ctx({ rng: seqRng([0.9, 0.9, 0.5]) })).roles)[0]).not.toBe("host");
  });

  test("fairness statistics: over many rounds a repeat is rare (about 1 in 7 with 3 players) but does happen", () => {
    let seed = 12345; // mulberry32: a small deterministic PRNG
    const rng = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const room = lobbyOf(3);
    let prev = intruderIds(RL.startRound(room, "host", { imposters: 1 }, ctx({ rng })).roles)[0];
    let repeats = 0;
    const rounds = 3000;
    const picked = new Set<string>([prev]);
    for (let i = 0; i < rounds; i++) {
      resolve(room, "host", "caught");
      RL.nextRound(room, "host", NOW);
      const cur = intruderIds(RL.startRound(room, "host", { imposters: 1 }, ctx({ rng })).roles)[0];
      if (cur === prev) repeats++;
      picked.add(cur);
      prev = cur;
    }
    const rate = repeats / rounds; // expected (1/3) / (2 + 1/3) = 1/7, about 0.143 (uniform random would be 0.333)
    expect(rate > 0.1).toBe(true);
    expect(rate < 0.2).toBe(true);
    expect(picked.size).toBe(3);
  });

  test("play again: a new round can start straight from the scores screen, keeping everyone's points", () => {
    const { room } = roundOf(4);
    resolve(room, "host", "caught");
    const before = Object.fromEntries(room.players.map((p) => [p.id, p.score]));
    expect(room.phase).toBe("scores");
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx());
    expect(room.phase).toBe("round");
    expect(room.round).toBe(2);
    expect(Object.keys(roles)).toHaveLength(4);
    room.players.forEach((p) => expect(p.score).toBe(before[p.id]));
  });
});

describe("a rejected call changes nothing (bug A1)", () => {
  test("startRound with too few connected players does not remove the disconnected ones", () => {
    const room = lobbyOf(4);
    RL.disconnect(room, "p2", NOW);
    RL.disconnect(room, "p3", NOW);
    const before = structuredClone(room);
    expect(() => RL.startRound(room, "host", { imposters: 1 }, ctx({ now: NOW + 10 * 60 * SEC }))).toThrow(/Need at least/);
    expect(room).toEqual(before);
  });

  test("startRound with no words changes nothing, not even the recently-used memory", () => {
    const room = lobbyOf(4);
    room.settings = { cats: ["nope"], imposters: 1, minutes: 3, hint: "category", lang: "en", customName: "", tw: false, qm: false, troll: false, twn: false, kn: false };
    const before = structuredClone(room);
    expect(() => RL.startRound(room, "host", {}, ctx({ packs: [] }))).toThrow(/No words/);
    expect(room).toEqual(before);
  });

  test("startRound in the wrong phase and nextRound in the wrong phase change nothing", () => {
    const { room } = roundOf(4);
    const before = structuredClone(room);
    expect(() => RL.startRound(room, "host", {}, ctx())).toThrow(/already running/);
    expect(() => RL.nextRound(room, "host", NOW)).toThrow(/No scores/);
    expect(room).toEqual(before);
  });

  test("pickWord never mutates the room", () => {
    const room = lobbyOf(3);
    const before = structuredClone(room);
    expect(RL.pickWord(room, PACKS, seqRng([0]))).not.toBeNull();
    expect(room).toEqual(before);
  });

  test("a successful start remembers the word, and words don't repeat until the pool is used up", () => {
    const room = lobbyOf(3);
    RL.updateSettings(room, "host", { lang: "en", cats: ["food"] }, PACKS); // 6 words
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { roles } = RL.startRound(room, "host", {}, ctx({ rng: seqRng([0.1, 0.9, 0.5, 0.3, 0.7]) }));
      seen.add(Object.values(roles).find((r) => r.word)?.word as string);
      resolve(room, "host", "caught");
    }
    expect(seen.size).toBe(6);
    expect(() => RL.startRound(room, "host", {}, ctx())).not.toThrow(); // pool exhausted: starts over
  });
});

describe("outcomes and scores", () => {
  test("caught / guessed / escaped match the points table", () => {
    for (const [kind, crewPts, impPts] of [["caught", 1, 0], ["guessed", 0, 1], ["escaped", 0, 2]] as const) {
      const { room, roles } = roundOf(4);
      const imp = intruderIds(roles)[0];
      const { delta } = resolve(room, "host", kind);
      expect(delta[imp]).toBe(impPts);
      Object.entries(delta).filter(([id]) => id !== imp).forEach(([, v]) => expect(v).toBe(crewPts));
    }
  });

  test("2+ intruders escaping: only the chosen ones score, the rest score like caught", () => {
    const room = lobbyOf(5);
    const { roles } = RL.startRound(room, "host", { imposters: 2 }, ctx());
    const imps = intruderIds(roles);
    const { delta } = resolve(room, "host", "escaped", [imps[0]]);
    expect(delta[imps[0]]).toBe(2);
    expect(delta[imps[1]]).toBe(0);
  });

  test("resolveOutcome requires a running round and a known kind", () => {
    const room = lobbyOf(3);
    expect(() => resolve(room, "host", "caught")).toThrow(/No round in progress/);
    RL.startRound(room, "host", {}, ctx());
    expect(() => resolve(room, "host", "nonsense")).toThrow(/Unknown outcome/);
    expect(room.phase).toBe("round");
  });

  test("scores persist across rounds; nextRound requires the scores phase", () => {
    const room = lobbyOf(3);
    expect(() => RL.nextRound(room, "host", NOW)).toThrow(/No scores to move on from/);
    RL.startRound(room, "host", {}, ctx());
    const { delta } = resolve(room, "host", "caught");
    const survivor = room.players.find((p) => delta[p.id] === 1)!;
    expect(survivor.score).toBe(1);
    RL.nextRound(room, "host", NOW);
    expect(room.phase).toBe("lobby");
    RL.startRound(room, "host", {}, ctx());
    expect(room.players.find((p) => p.id === survivor.id)!.score).toBe(1);
  });

  test("a seat that wasn't dealt in scores nothing when the round is resolved", () => {
    const room = lobbyOf(5);
    RL.startRound(room, "host", {}, ctx());
    room.players.push({ id: "ghost", name: "Ghost", l: 0, score: 0, connected: false, disconnectedAt: null, left: false, token: "t" });
    const { delta } = resolve(room, "host", "caught");
    expect(delta.ghost).toBe(0);
    expect(room.players.find((p) => p.id === "ghost")!.score).toBe(0);
  });
});

describe("discussion timer", () => {
  const T0 = NOW;
  const timer = (room: ReturnType<typeof lobbyOf>, at: number) => state(room, at).timer;

  test("start uses the room's minutes; nothing runs before the host starts it", () => {
    const { room } = roundOf(4, 3);
    expect(timer(room, T0)).toBeNull();
    RL.timerAction(room, "host", "start", T0);
    expect(timer(room, T0)).toEqual({ status: "running", remainingMs: 180000 });
    expect(timer(room, T0 + 45000)).toEqual({ status: "running", remainingMs: 135000 });
  });

  test("a 1-minute room is whitelisted and runs for exactly 60 s (it must not fall back to the 3-minute default)", () => {
    const { room } = roundOf(4, 1);
    expect(room.settings?.minutes).toBe(1);
    RL.timerAction(room, "host", "start", T0);
    expect(timer(room, T0)).toEqual({ status: "running", remainingMs: 60000 });
    expect(timer(room, T0 + 59000)).toEqual({ status: "running", remainingMs: 1000 });
  });

  test("only the host controls it, and only during a round with the timer switched on", () => {
    const { room } = roundOf(4, 3);
    expect(() => RL.timerAction(room, "p1", "start", T0)).toThrow(/Only the host/);
    expect(() => RL.timerAction(room, "host", "explode", T0)).toThrow(/Unknown timer action/);
    expect(() => RL.timerAction(roundOf(4, 0).room, "host", "start", T0)).toThrow(/timer is off/);
    expect(() => RL.timerAction(lobbyOf(4), "host", "start", T0)).toThrow(/No round in progress/);
  });

  test("pause freezes the remaining time and resume continues from it, exactly", () => {
    const { room } = roundOf(4, 2);
    RL.timerAction(room, "host", "start", T0);
    RL.timerAction(room, "host", "pause", T0 + 30000);
    expect(timer(room, T0 + 999999)).toEqual({ status: "paused", remainingMs: 90000 });
    RL.timerAction(room, "host", "resume", T0 + 100000);
    expect(timer(room, T0 + 100000)).toEqual({ status: "running", remainingMs: 90000 });
    expect(timer(room, T0 + 130000)).toEqual({ status: "running", remainingMs: 60000 });
  });

  test("stale or repeated taps are harmless no-ops", () => {
    const { room } = roundOf(4, 2);
    RL.timerAction(room, "host", "pause", T0);
    RL.timerAction(room, "host", "resume", T0);
    expect(timer(room, T0)).toBeNull();
    RL.timerAction(room, "host", "start", T0);
    RL.timerAction(room, "host", "start", T0 + 10000); // double-tap must NOT restart the clock
    expect(timer(room, T0 + 10000)?.remainingMs).toBe(110000);
  });

  test("+1 minute extends running and paused timers, and restarts one that ran out", () => {
    const { room } = roundOf(4, 2);
    RL.timerAction(room, "host", "start", T0);
    RL.timerAction(room, "host", "add", T0 + 20000);
    expect(timer(room, T0 + 20000)?.remainingMs).toBe(160000);
    RL.timerAction(room, "host", "pause", T0 + 20000);
    RL.timerAction(room, "host", "add", T0 + 20000);
    expect(timer(room, T0 + 20000)).toEqual({ status: "paused", remainingMs: 220000 });
    RL.timerAction(room, "host", "resume", T0 + 20000);
    expect(timer(room, T0 + 20000 + 300000)).toEqual({ status: "up", remainingMs: 0 });
    RL.timerAction(room, "host", "add", T0 + 400000);
    expect(timer(room, T0 + 400000)).toEqual({ status: "running", remainingMs: 60000 });
  });

  test("can't be stretched past the cap by spamming +1 minute", () => {
    const { room } = roundOf(4, 5);
    RL.timerAction(room, "host", "start", T0);
    for (let i = 0; i < 100; i++) RL.timerAction(room, "host", "add", T0);
    expect(timer(room, T0)?.remainingMs).toBe(RL.MAX_TIMER_MS);
  });

  test("ends with the round and never carries into the next one", () => {
    const { room } = roundOf(4, 3);
    RL.timerAction(room, "host", "start", T0);
    resolve(room, "host", "caught");
    expect(timer(room, T0)).toBeNull();
    RL.startRound(room, "host", {}, ctx());
    expect(timer(room, T0)).toBeNull();
  });
});

describe("outcome only after the reveal, and stale question taps", () => {
  test("the outcome of a round whose intruders were not shown is refused, and changes nothing", () => {
    const { room } = roundOf(4);
    expect(() => RL.resolveOutcome(room, "host", "caught")).toThrow(/Reveal the intruders/);
    expect(room.phase).toBe("round");
    expect(room.players.every((p) => p.score === 0)).toBe(true);
    RL.revealRound(room, "host");
    expect(RL.resolveOutcome(room, "host", "caught").room.phase).toBe("scores");
  });

  test("a question draw that names an old question is ignored (no skipped question)", () => {
    const room = modeLobby(4, { qm: true });
    RL.startRound(room, "host", {}, ctx());
    RL.startTalk(room, "host", ctx());
    const first = state(room).question!;
    RL.questionAction(room, "host", "next", ctx(), first.n); // counts
    const second = state(room).question!;
    expect(second.n).toBe(first.n + 1);
    RL.questionAction(room, "host", "next", ctx(), first.n); // the same tap arriving again: stale
    expect(state(room).question).toEqual(second);
    RL.questionAction(room, "host", "next", ctx()); // no n: always counts (older clients)
    expect(state(room).question?.n).toBe(second.n + 1);
  });
});
