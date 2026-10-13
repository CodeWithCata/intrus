/** Relaxed mode: longer timers, no negative points, calmer vibration. */
import { describe, expect, it } from "vitest";
import { RELAXED_PRESET, calmVibration, gentlePoints, talkSeconds } from "#lib/game/relaxed.ts";

describe("relaxed mode", () => {
  it("timers are 1.5 times longer, and Blitz still halves them", () => {
    expect(talkSeconds(3, false, false)).toBe(180);
    expect(talkSeconds(3, true, false)).toBe(270);
    expect(talkSeconds(2, true, true)).toBe(90);
    expect(talkSeconds(5, false, true)).toBe(150);
  });
  it("never gives negative points", () => {
    expect(gentlePoints(-2, true)).toBe(0);
    expect(gentlePoints(2, true)).toBe(2);
  });
  it("vibration is shorter and softer", () => {
    expect(calmVibration(200)).toBe(20);
    expect(calmVibration([200, 100, 200])).toEqual([20, 100, 20]);
    expect(calmVibration(6)).toBe(4);
  });
  it("the preset turns relaxed mode on with a longer timer and no surprises", () => {
    expect(RELAXED_PRESET).toEqual({ rx: true, tm: 5, tw: false, troll: false });
  });
});
