/** Simultaneous vote: availability, hit-testing and anonymous counts. */
import { describe, expect, it } from "vitest";
import { SIM_CAP, countTouches, simVoteAllowed, tileAt, votesFromCounts } from "#lib/game/simvote.ts";

const boxes = [{ left: 0, top: 0, right: 100, bottom: 100 }, { left: 110, top: 0, right: 210, bottom: 100 }, { left: 0, top: 110, right: 100, bottom: 210 }];

describe("simVoteAllowed", () => {
  it("works for up to 6 players with enough touch points", () => {
    expect(simVoteAllowed(4, 5, false)).toEqual({ ok: true });
    expect(simVoteAllowed(SIM_CAP, 10, false)).toEqual({ ok: true });
  });
  it("falls back, with a reason, online / over the cap / too few touch points", () => {
    expect(simVoteAllowed(4, 5, true)).toEqual({ ok: false, reason: "online" });
    expect(simVoteAllowed(SIM_CAP + 1, 10, false)).toEqual({ ok: false, reason: "cap" });
    expect(simVoteAllowed(5, 3, false)).toEqual({ ok: false, reason: "touch" });
    expect(simVoteAllowed(3, 0, false)).toEqual({ ok: false, reason: "touch" });
  });
});

describe("touches", () => {
  it("finds the tile under a point, or -1", () => {
    expect(tileAt({ x: 50, y: 50 }, boxes)).toBe(0);
    expect(tileAt({ x: 150, y: 20 }, boxes)).toBe(1);
    expect(tileAt({ x: 105, y: 50 }, boxes)).toBe(-1);
  });
  it("counts the fingers on every tile; fingers outside count for nobody", () => {
    const c = countTouches([{ x: 5, y: 5 }, { x: 6, y: 6 }, { x: 150, y: 50 }, { x: 500, y: 500 }], boxes);
    expect(c).toEqual([2, 1, 0]);
    expect(votesFromCounts(c)).toEqual([0, 0, 1]);
  });
});
