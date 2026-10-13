/**
 * "Lumina se stinge": the last seconds of the talk timer. Pure maths for the dim overlay's opacity and the heartbeat
 * vibration pattern; TalkDim.svelte and stores/talk.svelte.ts use them.
 */

/** The timer is in its `.low` state from this many seconds left. */
export const LOW_SECONDS = 10;
/** The most the screen dims (opacity of the flat overlay): the card text stays readable. */
export const MAX_DIM = 0.55;

/**
 * True on the one tick where the clock moves from above LOW_SECONDS into the last LOW_SECONDS (and is not yet at 0): that is
 * when the dimming starts, so it is when the "last seconds" cue (sound + red pulse on the ring) fires. It does not fire again
 * while the clock stays inside the zone, and not when a timer starts (or is restored) already inside it.
 */
export const entersLowZone = (prev: number, next: number): boolean => prev > LOW_SECONDS && next <= LOW_SECONDS && next > 0;

/** Opacity of the dim overlay with `t` whole seconds left: 0 above LOW_SECONDS, then rising to MAX_DIM at 0. */
export function dimLevel(t: number): number {
    if (t > LOW_SECONDS) {
        return 0;
    }
    const k = (LOW_SECONDS - Math.max(0, t)) / LOW_SECONDS;
    return Math.round(k * MAX_DIM * 100) / 100;
}

/**
 * Vibration pattern for the second that is starting with `t` seconds left (call it once a second while t <= LOW_SECONDS).
 * The heart beats faster as time runs out: one "lub-dub" per second at first, two, then three. `calm` (relaxed mode) is a
 * single short pulse. All patterns are shorter than one second, so they never overlap the next one.
 */
export function heartbeat(t: number, calm = false): number[] {
    if (calm) {
        return [10];
    }
    const beat = [40, 70, 40];
    const gap = (ms: number) => [ms];
    const beats = t > 6 ? 1 : t > 3 ? 2 : 3;
    const out: number[] = [];
    for (let i = 0; i < beats; i++) {
        out.push(...beat);
        if (i < beats - 1) {
            out.push(...gap(beats === 2 ? 140 : 90));
        }
    }
    return out;
}

/** Total length of a vibration pattern (ms). */
export const patternMs = (p: readonly number[]): number => p.reduce((a, b) => a + b, 0);
