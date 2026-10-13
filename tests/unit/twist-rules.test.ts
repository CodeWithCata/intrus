import { describe, expect, it } from "vitest";
import { TWIST_IDS, eligibleTwists, pickTwist, type TwistContext } from "#lib/game/twist-rules.ts";

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
    for (const id of ["adj", "mima", "rep"]) expect(list).not.toContain(id);
    expect(list).toContain("rev");
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
