import { describe, expect, it } from "vitest";
import { HIDDEN_TWISTS, PERSONAS, TWIST_IDS, eligibleTwists, pickPersona, pickTwist, type TwistContext } from "#lib/game/twist-rules.ts";

const base: TwistContext = { last: null, questions: false, timer: true, twin: false, players: 6, intruders: 1, related: 5 };

describe("which twists a round can get", () => {
  it("everything is possible in a roomy plain round", () => {
    expect(eligibleTwists(base)).toEqual([...TWIST_IDS]);
  });
  it("never the same twist twice in a row", () => {
    expect(eligibleTwists({ ...base, last: "dbl" })).not.toContain("dbl");
  });
  it("question mode drops the twists that change how people describe the card", () => {
    const list = eligibleTwists({ ...base, questions: true });
    for (const id of ["adj", "mima", "rep", "neg"]) expect(list).not.toContain(id);
    expect(list).toContain("rev");
    expect(list).toContain("voc"); // the character voice is about HOW people talk, so it works with the question deck
  });
  it("'only what it is NOT' and the character voice are possible in any round, even a tiny one", () => {
    const tiny = eligibleTwists({ ...base, players: 3, intruders: 1, related: 0, timer: false });
    expect(tiny).toContain("neg");
    expect(tiny).toContain("voc");
  });
  it("neither new twist is a secret (everybody is told, so everybody can play it)", () => {
    expect(HIDDEN_TWISTS).not.toContain("neg");
    expect(HIDDEN_TWISTS).not.toContain("voc");
  });
  it("the character voice is one of the personas, whatever the random number", () => {
    expect(pickPersona(() => 0)).toBe(0);
    expect(pickPersona(() => 0.9999)).toBe(PERSONAS.length - 1);
    expect(pickPersona(() => 1)).toBe(PERSONAS.length - 1); // never past the end, even for a rogue rng
    expect(new Set(PERSONAS).size).toBe(PERSONAS.length);
    expect(PERSONAS.length).toBeGreaterThanOrEqual(8);
  });
  it("Blitz needs a timer", () => {
    expect(eligibleTwists({ ...base, timer: false })).not.toContain("blitz");
  });
  it("the double agent needs three civilians, a related word and no twin words", () => {
    expect(eligibleTwists({ ...base, players: 3, intruders: 1 })).not.toContain("ag"); // 2 civilians
    expect(eligibleTwists({ ...base, related: 0 })).not.toContain("ag");
    expect(eligibleTwists({ ...base, twin: true })).not.toContain("ag");
  });
  it("an extra intruder only while the intruders stay a minority", () => {
    expect(eligibleTwists({ ...base, players: 4, intruders: 1 })).not.toContain("ex"); // 1 of 4 is already the maximum
    expect(eligibleTwists({ ...base, players: 6, intruders: 2 })).not.toContain("ex");
    expect(eligibleTwists({ ...base, players: 6, intruders: 1 })).toContain("ex");
  });
  it("a round gets a twist only 40% of the time, then one of the eligible ones", () => {
    expect(pickTwist(base, () => 0.4)).toBeNull();
    expect(pickTwist(base, () => 0.99)).toBeNull();
    const seq = [0.1, 0];
    expect(pickTwist(base, () => seq.shift() as number)).toBe("sopt");
    const last = [0.1, 0.9999];
    expect(pickTwist(base, () => last.shift() as number)).toBe("ex");
  });
  it("no eligible twist means a plain round", () => {
    expect(pickTwist({ ...base, players: 3, intruders: 3, related: 0, timer: false, questions: true, twin: true, last: null }, () => 0)).not.toBeNull(); // sopt, rev, dbl are always possible
  });
});
