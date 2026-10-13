/**
 * "Țineți apăsat pentru cuvânt": while the pass-screen card is open, hide it again the moment the phone could be seen by someone
 * else: the page loses focus or is hidden, the screen rotates, the phone is tilted away or shaken (when the motion sensors exist
 * and were allowed). Releasing the finger is handled by Card.svelte itself. The thresholds and the decision are plain functions,
 * so they are unit-tested; guardPeek() only wires the events.
 */

/** Degrees the phone may turn from how it was held when the card opened. */
export const TILT_LIMIT = 35;
/** m/s² away from gravity (9.81) that counts as a shake. */
export const SHAKE_DELTA = 11;

export type MotionPermission = "unknown" | "granted" | "denied" | "unavailable";

let permission: MotionPermission = "unknown";

export const motionPermission = (): MotionPermission => permission;

/** For tests only: forgets the permission answer. */
export const resetMotionPermission = (p: MotionPermission = "unknown") => {
    permission = p;
};

/** Shortest angular distance in degrees (handles the -180/180 wrap). */
const angleDiff = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

export const tiltedAway = (beta: number, gamma: number, base: { beta: number; gamma: number }): boolean =>
    angleDiff(beta, base.beta) > TILT_LIMIT || angleDiff(gamma, base.gamma) > TILT_LIMIT;

export const isShake = (a: { x: number | null; y: number | null; z: number | null }): boolean => {
    if (a.x === null || a.y === null || a.z === null) {
        return false;
    }
    return Math.abs(Math.hypot(a.x, a.y, a.z) - 9.81) > SHAKE_DELTA;
};

/**
 * Asks for the motion sensors, once. iOS shows a permission prompt and needs this to run from a user gesture (call it in the
 * pointerdown handler); other browsers just say yes. A refusal, or no sensors at all, simply means "hold only".
 */
export async function requestMotion(): Promise<MotionPermission> {
    if (permission !== "unknown") {
        return permission;
    }
    const DME = typeof DeviceMotionEvent === "undefined" ? null : (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> });
    if (!DME) {
        return (permission = "unavailable");
    }
    if (typeof DME.requestPermission === "function") {
        try {
            permission = (await DME.requestPermission()) === "granted" ? "granted" : "denied";
        }
        catch {
            permission = "denied";
        }
        return permission;
    }
    return (permission = "granted");
}

/** Starts watching; `hide` is called when the card must close. Returns the function that stops watching. */
export function guardPeek(hide: () => void, win: Window = window): () => void {
    const ac = new AbortController();
    const opt = { signal: ac.signal };
    const doc = win.document;
    doc.addEventListener("visibilitychange", () => doc.hidden && hide(), opt);
    for (const type of ["blur", "pagehide", "orientationchange"]) {
        win.addEventListener(type, hide, opt);
    }
    (win.screen?.orientation as EventTarget | undefined)?.addEventListener?.("change", hide, opt);
    if (permission === "granted") {
        let base: { beta: number; gamma: number } | null = null;
        win.addEventListener("deviceorientation", (e) => {
            const { beta, gamma } = e as DeviceOrientationEvent;
            if (beta === null || gamma === null || beta === undefined || gamma === undefined) {
                return;
            }
            if (!base) {
                base = { beta, gamma }; // how the phone was held when the card opened
            }
            else if (tiltedAway(beta, gamma, base)) {
                hide();
            }
        }, opt);
        win.addEventListener("devicemotion", (e) => {
            const a = (e as DeviceMotionEvent).accelerationIncludingGravity;
            if (a && isShake(a)) {
                hide();
            }
        }, opt);
    }
    return () => ac.abort();
}
