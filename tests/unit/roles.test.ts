import { describe, expect, it } from "vitest";
import { REPEAT_WEIGHT, pickIntruders } from "#lib/game/intruders.ts";

describe("pickIntruders (who is the intruder this round)", () => {
  it("picks the requested number of distinct players, and never more than there are", () => {
    const ids = [0, 1, 2, 3, 4];
    for (let k = 1; k <= 5; k++) {
      const got = pickIntruders(ids, [], k, Math.random);
      expect(got).toHaveLength(k);
      expect(new Set(got).size).toBe(k);
    }
    expect(pickIntruders([0, 1], [], 5, Math.random)).toHaveLength(2); // used to be an endless loop in the local game
    expect(pickIntruders([], [], 1, Math.random)).toEqual([]);
  });

  it("last round's intruder keeps a small chance: a low roll still lands on them, a high one does not", () => {
    // total weight = REPEAT_WEIGHT + 3, so the first slot covers [0, REPEAT_WEIGHT / total)
    const total = REPEAT_WEIGHT + 3;
    expect(pickIntruders([0, 1, 2, 3], [0], 1, () => 0.5 * (REPEAT_WEIGHT / total))).toEqual([0]);
    expect(pickIntruders([0, 1, 2, 3], [0], 1, () => 2 * (REPEAT_WEIGHT / total))).toEqual([1]);
    expect(pickIntruders([0, 1, 2, 3], [0], 1, () => 0.999999)).toEqual([3]);
  });

  it("with no history every player is equally likely", () => {
    expect(pickIntruders([0, 1, 2, 3], [], 1, () => 0.1)).toEqual([0]);
    expect(pickIntruders([0, 1, 2, 3], [], 1, () => 0.3)).toEqual([1]);
    expect(pickIntruders([0, 1, 2, 3], [], 1, () => 0.6)).toEqual([2]);
    expect(pickIntruders([0, 1, 2, 3], [], 1, () => 0.9)).toEqual([3]);
  });

  it("several intruders are drawn without replacement", () => {
    expect(pickIntruders([0, 1, 2, 3], [], 2, () => 0)).toEqual([0, 1]);
  });

  it("an rng value that rounds up to the total does not crash", () => {
    expect(pickIntruders([0, 1], [], 1, () => 1)).toHaveLength(1);
  });
});
