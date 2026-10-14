import { describe, expect, test } from "vitest";
import * as RL from "../room-logic.ts";
import { PERSONAS, pickPersona } from "../../src/lib/game/twist-rules.ts";
import { NOW, PACKS, PAIR_PACKS, SEC, ctx, everythingPublic, intruderIds, lobbyOf, modeLobby, roundOf, seqRng } from "./helpers.ts";

const state = (room: ReturnType<typeof lobbyOf>, now = NOW) => RL.publicState(room, now);

/** The host reveals first (the real flow), then picks the outcome. */
const resolve = (...args: Parameters<typeof RL.resolveOutcome>) => {
  if (args[0].current && !args[0].current.revealed) RL.revealRound(args[0], args[1]);
  return RL.resolveOutcome(...args);
};

describe("custom word lists (the host's own list, kept on the server)", () => {
  test("entries are word, word|category or word|category|hint; the separator and invisible characters are cleaned", () => {
    const room = lobbyOf(3);
    RL.updateSettings(room, "host", { customWords: ["alfa", "  beta | Litere |  a doua\u200B litera ", "gam|ma|x|y", "alfa|", "\u200B|Zero", "alfa|Altele"] }, PACKS);
    expect(room.customWords).toEqual(["alfa", "beta|Litere|a doua litera", "gam|ma|x", "alfa|Altele"]);
  });

  test("a single custom word is enough, and with no category picked the host's words are the whole pool", () => {
    const room = modeLobby(3, { cats: [], customWords: ["unicorn"] });
    expect(room.settings?.cats).toEqual([]);
    const { roles } = RL.startRound(room, "host", {}, ctx());
    expect(Object.values(roles).find((r) => r.word)?.word).toBe("unicorn");
  });

  test("with nothing picked and no words of its own, every category is in", () => {
    const room = modeLobby(3, { cats: [] });
    expect(room.settings?.cats).toEqual(PACKS.map((p) => p.id));
  });

  test("the host's words are added to the chosen categories, each with its own category name and hint", () => {
    const room = modeLobby(3, { cats: ["food"], customWords: ["alfa|Litere|prima literă", "beta"], customName: "Lista mea" });
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const picked = RL.pickWord(room, PACKS, seqRng([i / 40, 0]));
      if (picked) seen.add(picked.word + "/" + picked.category + "/" + (picked.customHint ?? ""));
    }
    expect(seen.has("alfa/Litere/prima literă")).toBe(true);
    expect(seen.has("beta/Lista mea/")).toBe(true);
    expect([...seen].some((x) => x.startsWith("pâine/Mâncare/"))).toBe(true);
  });

  test("a category that is the name of a pack joins that pack (any capitalisation), and its decoy comes from the pack", () => {
    const room = modeLobby(3, { cats: [], customWords: ["ciorbă|mâncare|se mănâncă fierbinte"] });
    const picked = RL.pickWord(room, PACKS, seqRng([0, 0]));
    expect(picked?.category).toBe("Mâncare");
    expect(PACKS[0].words.ro).toContain(picked?.decoy);
  });

  test("only an intruder gets the hint of a custom word, and it is never in the public state", () => {
    const room = modeLobby(4, { cats: [], customWords: ["alfa|Litere|prima literă"] });
    const { roles } = RL.startRound(room, "host", {}, ctx());
    for (const r of Object.values(roles)) expect(r.customHint).toBe(r.isIntruder ? "prima literă" : null);
    expect(everythingPublic(room).includes("prima literă")).toBe(false);
    expect(everythingPublic(room).includes("alfa")).toBe(false);
  });
});

describe("twin words", () => {
  test("civilians hold word A, intruders the similar word B, and nobody is told they are an intruder", () => {
    const room = modeLobby(4, { cats: ["food"], twn: true }, PAIR_PACKS);
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx({ packs: PAIR_PACKS }));
    expect(intruderIds(roles)).toHaveLength(0);
    const words = Object.entries(roles).map(([id, r]) => [id, r.word] as const);
    const odd = RL.publicState(room, NOW).reveal; // nothing yet
    expect(odd).toBeNull();
    expect(words.filter(([, w]) => w === "covrig")).toHaveLength(1);
    expect(words.filter(([, w]) => w === "pâine")).toHaveLength(3);
    for (const r of Object.values(roles)) {
      expect(r.decoy).toBeNull();
      expect(r.letter).toBeNull();
    }
  });

  test("the twin word is secret until the host reveals, then it is part of the reveal", () => {
    const room = modeLobby(4, { cats: ["food"], twn: true }, PAIR_PACKS);
    RL.startRound(room, "host", { imposters: 1 }, ctx({ packs: PAIR_PACKS }));
    expect(everythingPublic(room).includes("covrig")).toBe(false);
    RL.revealRound(room, "host");
    expect(RL.publicState(room, NOW).reveal?.twin).toBe("covrig");
  });

  test("nobody can 'guess' a word they do not know they have missed: that outcome is refused", () => {
    const room = modeLobby(4, { cats: ["food"], twn: true }, PAIR_PACKS);
    RL.startRound(room, "host", { imposters: 1 }, ctx({ packs: PAIR_PACKS }));
    expect(() => resolve(room, "host", "guessed")).toThrow(/twin/i);
    expect(resolve(room, "host", "escaped").room.phase).toBe("scores");
  });

  test("a category without pairs, or a game in English, plays a normal round", () => {
    const noPairs = modeLobby(4, { cats: ["pets"], twn: true }, PAIR_PACKS);
    const a = RL.startRound(noPairs, "host", { imposters: 1 }, ctx({ packs: PAIR_PACKS }));
    expect(intruderIds(a.roles)).toHaveLength(1);
    const english = modeLobby(4, { cats: ["food"], twn: true, lang: "en" }, PAIR_PACKS);
    const b = RL.startRound(english, "host", { imposters: 1 }, ctx({ packs: PAIR_PACKS }));
    expect(intruderIds(b.roles)).toHaveLength(1);
  });
});

describe("troll rounds", () => {
  test("everybody is an intruder (with the hint), nobody has the word, and it is secret until the reveal", () => {
    const room = modeLobby(4, { troll: true });
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx()); // rng 0 < 0.2: the surprise comes up
    expect(intruderIds(roles)).toHaveLength(4);
    for (const r of Object.values(roles)) expect(r.word).toBeNull();
    expect(room.lastImposterIds).toEqual([]);
    expect(RL.publicState(room, NOW).reveal).toBeNull();
    expect(everythingPublic(room).includes("intruderIds")).toBe(false);
    RL.revealRound(room, "host");
    const reveal = RL.publicState(room, NOW).reveal;
    expect(reveal?.troll).toBe(true);
    expect(reveal?.intruderIds).toHaveLength(4);
  });

  test("needs 4 players and the switch, and the chance is 20%", () => {
    expect(intruderIds(RL.startRound(modeLobby(3, { troll: true }), "host", {}, ctx()).roles)).toHaveLength(1);
    expect(intruderIds(RL.startRound(modeLobby(4, { troll: false }), "host", {}, ctx()).roles)).toHaveLength(1);
    // word 0, decoy 0, intruder 0, then the roll: 0.2 is NOT below 0.2
    expect(intruderIds(RL.startRound(modeLobby(4, { troll: true }), "host", {}, ctx({ rng: seqRng([0, 0, 0, 0.2]) })).roles)).toHaveLength(1);
  });

  test("it ends only as a surprise: no winner, no points", () => {
    const room = modeLobby(4, { troll: true });
    RL.startRound(room, "host", {}, ctx());
    expect(() => resolve(room, "host", "caught")).toThrow(/troll/i);
    const { delta } = resolve(room, "host", "troll");
    expect(Object.values(delta).every((d) => d === 0)).toBe(true);
    expect(room.players.every((p) => p.score === 0)).toBe(true);
    expect(room.phase).toBe("scores");
  });

  test("the surprise outcome is refused in an ordinary round", () => {
    const { room } = roundOf(4);
    expect(() => resolve(room, "host", "troll")).toThrow(/only for a troll/i);
  });
});

describe("intruders who know each other", () => {
  test("each intruder is told who the other intruders are; civilians are told nothing", () => {
    const room = modeLobby(6, { kn: true });
    const { roles } = RL.startRound(room, "host", { imposters: 2 }, ctx());
    const intr = intruderIds(roles);
    expect(intr).toHaveLength(2);
    expect(roles[intr[0]].mates).toEqual([intr[1]]);
    expect(roles[intr[1]].mates).toEqual([intr[0]]);
    for (const [id, r] of Object.entries(roles)) if (!intr.includes(id)) expect(r.mates).toEqual([]);
  });

  test("needs 2 intruders and 6 players, and the switch", () => {
    for (const [n, k, kn] of [[5, 2, true], [6, 1, true], [6, 2, false]] as const) {
      const { roles } = RL.startRound(modeLobby(n, { kn }), "host", { imposters: k }, ctx());
      for (const r of Object.values(roles)) expect(r.mates).toEqual([]);
    }
  });

  test("never together with twin words", () => {
    const room = modeLobby(6, { kn: true, twn: true, cats: ["food"] }, PAIR_PACKS);
    const { roles } = RL.startRound(room, "host", { imposters: 2 }, ctx({ packs: PAIR_PACKS }));
    for (const r of Object.values(roles)) expect(r.mates).toEqual([]);
  });

  test("the partners are restored with the role after a reconnect", () => {
    const room = modeLobby(6, { kn: true });
    const { roles } = RL.startRound(room, "host", { imposters: 2 }, ctx());
    for (const id of Object.keys(roles)) expect(RL.roleFor(room, id)).toEqual(roles[id]);
  });
});

/** rng values: word, decoy, intruder, (troll off), twist roll, twist pick, then whatever the twist draws. */
const twistRng = (pick: number, ...more: number[]) => seqRng([0, 0, 0, 0, pick, ...more]);

describe("twists", () => {
  test("a plain round without the switch never gets one, and draws no extra random numbers", () => {
    const off = modeLobby(4, { tw: false });
    RL.startRound(off, "host", {}, ctx({ rng: twistRng(0.76) }));
    expect(off.current?.twist).toBeNull();
    expect(off.lastTwist).toBeNull();
  });

  test("a twist is announced to everybody only once the discussion has started, and is remembered for next round", () => {
    const room = modeLobby(4, { tw: true });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0) })); // the first eligible twist: whisper
    expect(room.current?.twist).toBe("sopt");
    expect(room.lastTwist).toBe("sopt");
    expect(RL.publicState(room, NOW).twist).toBeNull();
    RL.startTalk(room, "host", ctx());
    expect(RL.publicState(room, NOW).twist).toBe("sopt");
  });

  test("double or nothing doubles the points", () => {
    const room = modeLobby(4, { tw: true });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.76) }));
    expect(room.current?.twist).toBe("dbl");
    const { delta } = resolve(room, "host", "caught");
    expect(Object.values(delta).filter((d) => d === 2)).toHaveLength(3);
    expect(room.players.filter((p) => p.score === 2)).toHaveLength(3);
  });

  test("Blitz halves the discussion time", () => {
    const room = modeLobby(4, { tw: true, minutes: 2 });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.65) }));
    expect(room.current?.twist).toBe("blitz");
    RL.startTalk(room, "host", ctx());
    const later = NOW + RL.TALK_LEAD_MS + RL.WHEEL_TOTAL_MS;
    expect(RL.publicState(room, later).timer?.remainingMs).toBe(60 * SEC);
  });

  test("'only what it is NOT' is a plain rule twist: told to everybody once the discussion starts, nothing else changes", () => {
    const room = modeLobby(4, { tw: true });
    const { roles } = RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.5) }));
    expect(room.current?.twist).toBe("neg");
    expect(room.current?.persona).toBeNull();
    expect(intruderIds(roles)).toHaveLength(1);
    expect(RL.publicState(room, NOW).twist).toBeNull();
    RL.startTalk(room, "host", ctx());
    expect(RL.publicState(room, NOW).twist).toBe("neg");
    expect(RL.publicState(room, NOW).persona).toBeNull();
    const { delta } = resolve(room, "host", "caught");
    expect(Object.values(delta).filter((d) => d === 1)).toHaveLength(3); // no points change
  });

  test("question mode never rolls 'only what it is NOT'", () => {
    for (let i = 0; i < 40; i++) {
      const room = modeLobby(4, { tw: true, qm: true });
      RL.startRound(room, "host", {}, ctx({ rng: twistRng(i / 40) }));
      expect(room.current?.twist).not.toBe("neg");
    }
  });

  test("the character voice is picked by the server, so every phone shows the same one, and it is public only with the twist", () => {
    const room = modeLobby(4, { tw: true });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.85, 0.5) }));
    expect(room.current?.twist).toBe("voc");
    expect(room.current?.persona).toBe(pickPersona(() => 0.5));
    expect(RL.publicState(room, NOW).persona).toBeNull(); // not before the discussion, like every twist
    RL.startTalk(room, "host", ctx());
    expect(RL.publicState(room, NOW).twist).toBe("voc");
    expect(RL.publicState(room, NOW).persona).toBe(pickPersona(() => 0.5));
    expect(PERSONAS[RL.publicState(room, NOW).persona as number]).toBe("Povestitor de documentar");
    RL.revealRound(room, "host");
    expect(RL.publicState(room, NOW).persona).toBe(pickPersona(() => 0.5)); // still on show while the round lasts
    expect(RL.publicState(room, NOW).reveal).toEqual(expect.objectContaining({ twist: "voc" }));
  });

  test("only the character-voice round draws a persona (other twists and plain rounds draw nothing extra)", () => {
    const plain = modeLobby(4, { tw: false });
    RL.startRound(plain, "host", {}, ctx({ rng: twistRng(0.85, 0.5) }));
    expect(plain.current?.persona).toBeNull();
    const other = modeLobby(4, { tw: true });
    RL.startRound(other, "host", {}, ctx({ rng: twistRng(0.5) }));
    expect(other.current?.persona).toBeNull();
    RL.startTalk(other, "host", ctx());
    expect(RL.publicState(other, NOW).persona).toBeNull();
  });

  test("a room saved before the character voice existed still loads and shows no persona", () => {
    const room = modeLobby(4, { tw: true });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.85, 0.5) }));
    RL.startTalk(room, "host", ctx());
    delete (room.current as unknown as Record<string, unknown>).persona;
    expect(RL.publicState(room, NOW).persona).toBeNull();
  });

  test("the double agent holds the related word as if it were THE word, and it stays secret until the reveal", () => {
    const room = modeLobby(4, { tw: true });
    const { roles } = RL.startRound(room, "host", {}, ctx({ rng: twistRng(0.9, 0, 0) }));
    const c = room.current;
    expect(c?.twist).toBe("ag");
    const agent = c?.agentId as string;
    expect(roles[agent].isIntruder).toBe(false);
    expect(roles[agent].word).toBe(c?.word2);
    expect(roles[agent].word).not.toBe(c?.word);
    expect(PACKS.flatMap((p) => p.words.ro)).toContain(c?.word2);
    RL.startTalk(room, "host", ctx());
    expect(RL.publicState(room, NOW).twist).toBeNull();
    expect(everythingPublic(room).includes(c?.word2 as string)).toBe(false);
    RL.revealRound(room, "host");
    const reveal = RL.publicState(room, NOW).reveal;
    expect(reveal?.twist).toBe("ag");
    expect(reveal?.agentId).toBe(agent);
    expect(reveal?.word2).toBe(c?.word2);
    expect(RL.roleFor(room, agent)).toEqual(roles[agent]);
  });

  test("an extra intruder is picked from the civilians, and the reveal says how many there were before", () => {
    const room = modeLobby(6, { tw: true });
    const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx({ rng: twistRng(0.95, 0) }));
    expect(room.current?.twist).toBe("ex");
    expect(intruderIds(roles)).toHaveLength(2);
    RL.startTalk(room, "host", ctx());
    expect(RL.publicState(room, NOW).twist).toBeNull(); // secret until the reveal
    RL.revealRound(room, "host");
    const reveal = RL.publicState(room, NOW).reveal;
    expect(reveal?.twist).toBe("ex");
    expect(reveal?.baseIntruders).toBe(1);
    expect(reveal?.intruderIds).toHaveLength(2);
  });

  test("no troll round carries a twist", () => {
    const room = modeLobby(4, { tw: true, troll: true });
    RL.startRound(room, "host", {}, ctx());
    expect(room.current?.troll).toBe(true);
    expect(room.current?.twist).toBeNull();
  });

  test("the next round never repeats the last twist", () => {
    const room = modeLobby(4, { tw: true });
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0) }));
    resolve(room, "host", "caught");
    RL.nextRound(room, "host", NOW);
    RL.startRound(room, "host", {}, ctx({ rng: twistRng(0) }));
    expect(room.current?.twist).toBe("rev"); // whisper was last time, so the first eligible one is now "rev"
  });
});

describe("question mode", () => {
  const talking = (n = 4, settings: Record<string, unknown> = {}) => {
    const room = modeLobby(n, { qm: true, ...settings });
    RL.startRound(room, "host", {}, ctx());
    RL.startTalk(room, "host", ctx({ rng: seqRng([0.99]) }));
    return room;
  };

  test("the starter asks the first question, and every phone sees the same one", () => {
    const room = talking();
    const s = state(room);
    expect(s.question?.askerId).toBe(room.current?.talk?.starterId);
    expect(typeof s.question?.q).toBe("string");
    expect(s.question?.q.length).toBeGreaterThan(5);
    expect(JSON.stringify(s).includes("deck")).toBe(false);
  });

  test("no questions without the switch, before the discussion, or after the reveal", () => {
    const off = modeLobby(4, { qm: false });
    RL.startRound(off, "host", {}, ctx());
    RL.startTalk(off, "host", ctx());
    expect(state(off).question).toBeNull();
    const on = modeLobby(4, { qm: true });
    RL.startRound(on, "host", {}, ctx());
    expect(state(on).question).toBeNull();
    expect(() => RL.questionAction(on, "host", "next", ctx())).toThrow(/no questions/i);
    RL.startTalk(on, "host", ctx());
    expect(state(on).question).not.toBeNull();
    RL.revealRound(on, "host");
    expect(state(on).question).toBeNull();
  });

  test("'next' hands over to the next connected player, 'other' only changes the question", () => {
    const room = talking();
    const ids = room.current?.playerIds as string[];
    const first = state(room).question;
    RL.questionAction(room, "host", "other", ctx());
    const other = state(room).question;
    expect(other?.askerId).toBe(first?.askerId);
    expect(other?.q).not.toBe(first?.q);
    RL.questionAction(room, "host", "next", ctx());
    expect(state(room).question?.askerId).toBe(ids[(ids.indexOf(first?.askerId as string) + 1) % ids.length]);
  });

  test("a player who dropped is skipped", () => {
    const room = talking();
    const ids = room.current?.playerIds as string[];
    const asker = state(room).question?.askerId as string;
    const gone = ids[(ids.indexOf(asker) + 1) % ids.length];
    RL.disconnect(room, gone, NOW);
    RL.questionAction(room, "host", "next", ctx());
    expect(state(room).question?.askerId).toBe(ids[(ids.indexOf(asker) + 2) % ids.length]);
  });

  test("the Reverse twist sends the questions the other way round", () => {
    const room = modeLobby(4, { qm: true });
    RL.startRound(room, "host", {}, ctx());
    (room.current as NonNullable<typeof room.current>).twist = "rev";
    RL.startTalk(room, "host", ctx({ rng: seqRng([0.5]) }));
    const ids = room.current?.playerIds as string[];
    const asker = state(room).question?.askerId as string;
    RL.questionAction(room, "host", "next", ctx());
    expect(state(room).question?.askerId).toBe(ids[(ids.indexOf(asker) - 1 + ids.length) % ids.length]);
  });

  test("only the host or the player who is asking may draw", () => {
    const room = talking();
    const asker = state(room).question?.askerId as string;
    const bystander = (room.current?.playerIds as string[]).find((id) => id !== asker && id !== "host") as string;
    expect(() => RL.questionAction(room, bystander, "next", ctx())).toThrow(/host or the player asking/);
    RL.questionAction(room, asker, "other", ctx());
    expect(() => RL.questionAction(room, "host", "skip", ctx())).toThrow(/Unknown/);
  });

  test("the deck runs through every question before any comes back", () => {
    const room = talking();
    const seen = new Set<string>([state(room).question?.q as string]);
    for (let i = 0; i < 29; i++) {
      RL.questionAction(room, "host", "other", ctx({ rng: seqRng([0.3, 0.6, 0.9]) }));
      seen.add(state(room).question?.q as string);
    }
    expect(seen.size).toBe(30);
  });
});
