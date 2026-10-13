/**
 * The opening wheel ("Roata începătorului"): maths only. The engine has already chosen `round.first`; this works out the
 * angle that makes the wheel stop exactly on that player, and when the pointer passes each slice (for tick sounds and a
 * vibration per slice). Slice 0 is at the top (under the pointer) when the wheel is at 0 degrees; the wheel turns clockwise.
 */

export const WHEEL_MS = 3200;
/** Pause (ms) between the wheel stopping on its player and the "Începe ..." line being announced. Skipping the spin waits for it too. */
export const WHEEL_SETTLE_MS = 700;
/** Same curve as the CSS/Web Animations easing used by the component: a fast start and a long, slow stop. */
export const WHEEL_EASING: readonly [number, number, number, number] = [0.12, 0.6, 0.1, 1];

export const sliceDeg = (n: number): number => 360 / n;

/**
 * Total rotation (degrees, clockwise, > 0) that leaves slice `first` under the pointer. `jitter` is in (-0.4, 0.4): where in
 * the slice it stops (0 = dead centre), so two spins do not always look the same. `spins` full turns are added.
 */
export function landingAngle(n: number, first: number, spins = 4, jitter = 0): number {
    const seg = sliceDeg(n);
    const j = Math.max(-0.4, Math.min(0.4, jitter));
    return spins * 360 - first * seg + j * seg;
}

/** Which slice is under the pointer after the wheel turned `angle` degrees. */
export function sliceAtPointer(angle: number, n: number): number {
    const seg = sliceDeg(n);
    const a = (((-angle) % 360) + 360) % 360;
    return Math.round(a / seg) % n;
}

/** Progress (0..1) of a CSS cubic-bezier easing at time fraction `t` (0..1). */
export function bezierAt(t: number, [x1, y1, x2, y2]: readonly [number, number, number, number] = WHEEL_EASING): number {
    if (t <= 0) {
        return 0;
    }
    if (t >= 1) {
        return 1;
    }
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    // solve x(s) = t for s by bisection (x is monotonic for the curves used here)
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 40; i++) {
        s = (lo + hi) / 2;
        const x = ((ax * s + bx) * s + cx) * s;
        if (x < t) {
            lo = s;
        }
        else {
            hi = s;
        }
    }
    return ((ay * s + by) * s + cy) * s;
}

/**
 * Times (ms from the start) at which the pointer crosses into the next slice while the wheel turns `angle` degrees in `ms`.
 * The gaps grow as the wheel slows down, which is what makes the ticks sound like a decelerating wheel.
 */
export function tickTimes(angle: number, n: number, ms: number = WHEEL_MS): number[] {
    const seg = sliceDeg(n), out: number[] = [];
    for (let k = 0; (k + 0.5) * seg < angle; k++) {
        const target = ((k + 0.5) * seg) / angle;
        let lo = 0, hi = 1;
        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            if (bezierAt(mid) < target) {
                lo = mid;
            }
            else {
                hi = mid;
            }
        }
        out.push(Math.round(hi * ms));
    }
    return out;
}

export interface WheelPlan {
    /** Degrees to rotate (clockwise). */
    angle: number;
    ms: number;
    ticks: number[];
}

/** Everything the component needs: the angle that lands on `first`, its duration and the tick times. */
export function planWheel(n: number, first: number, rng: () => number = Math.random, spins = 4): WheelPlan {
    const angle = landingAngle(n, first, spins, (rng() - 0.5) * 0.7);
    return { angle, ms: WHEEL_MS, ticks: tickTimes(angle, n) };
}
