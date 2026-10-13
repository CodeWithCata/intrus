/**
 * Frame-time maths shared by the player-facing "weak phone" hint (components/settings/lite-hint.ts) and the developer
 * performance debugger (components/debug). Pure: no DOM, no app imports, unit-tested (tests/unit/frame-stats.test.ts).
 */

/** Frame budgets of the common refresh rates: 120, 90, 60 and 30 Hz (iOS Low Power Mode caps at 30). */
export const FRAME_BUDGETS = [1000 / 120, 1000 / 90, 1000 / 60, 1000 / 30] as const;

/** A frame is "late" when it took this many budgets: vsync jitter alone never reaches it. */
export const LATE_FACTOR = 1.5;

/** Snaps a measured frame interval to the closest real refresh rate. */
export function snapBudget(ms: number): number {
    let best: number = FRAME_BUDGETS[2];
    let dist = Infinity;
    for (const b of FRAME_BUDGETS) {
        const d = Math.abs(b - ms);
        if (d < dist) {
            dist = d;
            best = b;
        }
    }
    return best;
}

/** Linear-interpolated percentile of an ascending array (p from 0 to 1). */
export function percentile(sorted: readonly number[], p: number): number {
    if (!sorted.length) {
        return 0;
    }
    const i = (sorted.length - 1) * Math.min(1, Math.max(0, p));
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export interface FrameSummary {
    frames: number;
    /** Total time covered by the frames, ms. */
    ms: number;
    fps: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    worst: number;
    /** Frames that took more than LATE_FACTOR budgets. */
    late: number;
    lateRatio: number;
    /** Time lost to late frames, in ms per second of running: the single number the profiler compares. */
    lostPerSec: number;
}

export function summarizeFrames(deltas: readonly number[], budget: number): FrameSummary {
    const n = deltas.length;
    if (!n) {
        return { frames: 0, ms: 0, fps: 0, avg: 0, p50: 0, p95: 0, p99: 0, worst: 0, late: 0, lateRatio: 0, lostPerSec: 0 };
    }
    const sorted = [...deltas].sort((a, b) => a - b);
    let total = 0;
    let late = 0;
    let lost = 0;
    for (const d of deltas) {
        total += d;
        if (d > budget * LATE_FACTOR) {
            late++;
            lost += d - budget;
        }
    }
    return {
        frames: n,
        ms: total,
        fps: total > 0 ? n / (total / 1000) : 0,
        avg: total / n,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        worst: sorted[n - 1],
        late,
        lateRatio: late / n,
        lostPerSec: total > 0 ? lost / (total / 1000) : 0
    };
}

/* ---------- "does this device run poorly?" ---------- */

/** A frame slower than this (under 40 fps) is felt as stutter on any refresh rate. */
export const SLOW_FRAME_MS = 25;

export interface FrameJudgeOptions {
    /** Ignore this long after the first frame: startup (decoding, hydration) is heavier than normal play. */
    warmupMs?: number;
    /** Frames per judged window (150 is about 2.5 s at 60 fps). */
    windowFrames?: number;
    /** Share of slow frames that makes a window poor. */
    poorRatio?: number;
    /** Consecutive poor windows needed: one bad stretch (a sheet opening, a GC pause) is not enough. */
    needPoor?: number;
    /** Give up (verdict "ok") after this much time without enough poor windows. */
    maxMs?: number;
}

export type FrameVerdict = "poor" | "ok" | null;

/**
 * Feed it every frame delta (ms) with the current time; it answers "poor" once the device has stuttered through several
 * windows in a row, "ok" when the observation time is over without that, and null while it is still watching.
 * The first verdict is final: call `reset()` after the page was hidden, since frames stop and restart then.
 */
export function createFrameJudge(options: FrameJudgeOptions = {}) {
    const warmup = options.warmupMs ?? 3000;
    const size = options.windowFrames ?? 150;
    const ratio = options.poorRatio ?? 0.3;
    const need = options.needPoor ?? 2;
    const maxMs = options.maxMs ?? 45000;
    let start = -1;
    let frames = 0;
    let slow = 0;
    let poorRun = 0;
    let done: FrameVerdict = null;
    return {
        push(delta: number, now: number): FrameVerdict {
            if (done) {
                return done;
            }
            if (start < 0) {
                start = now;
            }
            if (now - start < warmup) {
                return null;
            }
            frames++;
            if (delta > SLOW_FRAME_MS) {
                slow++;
            }
            if (frames >= size) {
                poorRun = slow / frames >= ratio ? poorRun + 1 : 0;
                frames = 0;
                slow = 0;
                if (poorRun >= need) {
                    done = "poor";
                    return done;
                }
            }
            if (now - start > maxMs) {
                done = "ok";
            }
            return done;
        },
        /** Forget the current window (the page was hidden or frozen). */
        reset(): void {
            frames = 0;
            slow = 0;
            poorRun = 0;
        }
    };
}
