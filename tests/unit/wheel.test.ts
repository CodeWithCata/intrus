/** The opening wheel always lands exactly on round.first, for 2 to 12 players. */
import { describe, expect, it } from "vitest";
import { WHEEL_MS, bezierAt, landingAngle, planWheel, sliceAtPointer, tickTimes } from "#lib/game/wheel.ts";

describe("wheel", () => {
  it("lands on the chosen player for 2-12 players, every seat, any jitter", () => {
    for (let n = 2; n <= 12; n++) {
      for (let first = 0; first < n; first++) {
        for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
          const plan = planWheel(n, first, () => r);
          expect(sliceAtPointer(plan.angle, n)).toBe(first);
          expect(plan.angle > 360).toBe(true); // it really spins
        }
      }
    }
  });

  it("landingAngle with no jitter stops dead centre on the slice", () => {
    expect(sliceAtPointer(landingAngle(5, 3, 4, 0), 5)).toBe(3);
    expect(((-landingAngle(4, 1, 2, 0)) % 360 + 360) % 360).toBeCloseTo(90, 5);
  });

  it("ticks once per slice passed, slowing down", () => {
    const n = 6, angle = landingAngle(n, 2, 4, 0), t = tickTimes(angle, n);
    expect(t).toHaveLength(Math.floor(angle / (360 / n) - 0.5) + 1);
    for (let i = 1; i < t.length; i++) expect(t[i] >= t[i - 1]).toBe(true);
    expect(t[t.length - 1] <= WHEEL_MS).toBe(true);
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    expect(gaps[gaps.length - 1] > gaps[0]).toBe(true); // decelerating
  });

  it("the easing starts at 0, ends at 1 and never goes backwards", () => {
    expect(bezierAt(0)).toBe(0);
    expect(bezierAt(1)).toBe(1);
    let p = 0;
    for (let i = 1; i <= 100; i++) { const v = bezierAt(i / 100); expect(v >= p - 1e-9).toBe(true); p = v; }
  });
});
