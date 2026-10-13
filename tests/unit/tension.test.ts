/** "Lumina se stinge": dim level and heartbeat in the last 10 seconds. */
import { describe, expect, it } from "vitest";
import { LOW_SECONDS, MAX_DIM, dimLevel, entersLowZone, heartbeat, patternMs } from "#lib/game/tension.ts";

describe("dimLevel", () => {
  it("is 0 until the last 10 seconds, then rises to the maximum at 0", () => {
    expect(dimLevel(60)).toBe(0);
    expect(dimLevel(LOW_SECONDS + 1)).toBe(0);
    expect(dimLevel(LOW_SECONDS)).toBe(0);
    expect(dimLevel(0)).toBe(MAX_DIM);
    for (let t = LOW_SECONDS; t > 0; t--) expect(dimLevel(t - 1) >= dimLevel(t)).toBe(true);
    expect(dimLevel(-3)).toBe(MAX_DIM);
  });
});

describe("heartbeat", () => {
  it("beats faster as time runs out, and always fits in one second", () => {
    const beats = (t: number) => heartbeat(t).filter((_, i) => i % 2 === 0).length;
    expect(beats(10) < beats(5)).toBe(true);
    expect(beats(5) < beats(2)).toBe(true);
    for (let t = 1; t <= 10; t++) expect(patternMs(heartbeat(t)) < 1000).toBe(true);
  });
  it("is one gentle pulse when calm (relaxed mode)", () => {
    expect(heartbeat(3, true)).toEqual([10]);
  });
});

describe("entersLowZone (the tick where the dimming starts)", () => {
  it("is true only on the tick that crosses into the last seconds", () => {
    expect(entersLowZone(LOW_SECONDS + 1, LOW_SECONDS)).toBe(true);
    // a throttled tab can skip several seconds: still one crossing
    expect(entersLowZone(LOW_SECONDS + 4, LOW_SECONDS - 2)).toBe(true);
  });
  it("is false while the clock stays inside the zone, above it, or when it already ran out", () => {
    expect(entersLowZone(LOW_SECONDS, LOW_SECONDS - 1)).toBe(false);
    expect(entersLowZone(LOW_SECONDS + 5, LOW_SECONDS + 4)).toBe(false);
    expect(entersLowZone(LOW_SECONDS + 2, 0)).toBe(false);
  });
  it("is false for a timer that starts (or is restored) already inside the zone", () => {
    expect(entersLowZone(LOW_SECONDS - 3, LOW_SECONDS - 4)).toBe(false);
  });
});
