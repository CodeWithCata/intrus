/** Frame maths shared by the debugger and the player-facing "weak phone" hint, and the judge that decides when a device stutters. */
import { describe, expect, it } from "vitest";
import { createFrameJudge, percentile, snapBudget, summarizeFrames, type FrameVerdict } from "#lib/utils/frame-stats.ts";

/** Feeds `seconds` of frames with a given delta (or a function of the time) and returns the first verdict. */
function run(delta: number | ((t: number) => number), seconds: number, judge = createFrameJudge()): { verdict: FrameVerdict; at: number } {
    let t = 1000;
    const end = t + seconds * 1000;
    while (t < end) {
        const d = typeof delta === "number" ? delta : delta(t - 1000);
        t += d;
        const v = judge.push(d, t);
        if (v) {
            return { verdict: v, at: (t - 1000) / 1000 };
        }
    }
    return { verdict: null, at: seconds };
}

describe("frame maths", () => {
    it("snaps to the real refresh rates and interpolates percentiles", () => {
        expect(snapBudget(16.2)).toBeCloseTo(1000 / 60);
        expect(snapBudget(8.6)).toBeCloseTo(1000 / 120);
        expect(percentile([10, 20], 0.5)).toBe(15);
        expect(summarizeFrames([], 16.7).frames).toBe(0);
    });
});

describe("frame judge", () => {
    it("never accuses a smooth device, at 60 or 120 Hz", () => {
        expect(run(16.7, 60).verdict).toBe("ok");
        expect(run(8.3, 60).verdict).toBe("ok");
    });

    it("says nothing while it is still watching", () => {
        expect(run(16.7, 20).verdict).toBeNull();
    });

    it("flags a device that stutters window after window, well inside the observation time", () => {
        const r = run(40, 60);
        expect(r.verdict).toBe("poor");
        expect(r.at).toBeLessThan(25);
    });

    it("treats a device locked at 30 fps as poor (it cannot tell that from a slow phone, and lite mode is harmless there)", () => {
        expect(run(33.4, 60).verdict).toBe("poor");
    });

    it("ignores the startup stretch", () => {
        expect(run(t => (t < 2900 ? 80 : 16.7), 60).verdict).toBe("ok");
    });

    it("a short hitch is not enough: a sheet opening, a theme change or a GC pause must not trigger it", () => {
        // 30 frames of 60 ms (about 2 s) twice, in otherwise smooth play
        let n = 0;
        const r = run(() => (++n % 500 < 30 ? 60 : 16.7), 60);
        expect(r.verdict).toBe("ok");
    });

    it("the first verdict is final, and reset forgets a window", () => {
        const j = createFrameJudge({ warmupMs: 0, windowFrames: 10, needPoor: 2 });
        let t = 0;
        for (let i = 0; i < 9; i++) {
            j.push(50, (t += 50));
        }
        j.reset();
        for (let i = 0; i < 10; i++) {
            j.push(50, (t += 50));
        }
        for (let i = 0; i < 9; i++) {
            expect(j.push(50, (t += 50))).toBeNull();
        }
        expect(j.push(50, (t += 50))).toBe("poor");
        expect(j.push(10, t + 10)).toBe("poor");
    });
});
