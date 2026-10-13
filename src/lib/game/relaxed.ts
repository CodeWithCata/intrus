/**
 * "Mod relaxat": bigger text, longer timers, no negative points, gentle effects. Pure helpers shared by the talk screen, the
 * session restore and the setup preset.
 */

/** Relaxed mode makes every discussion timer this much longer. */
export const RELAXED_TIME_FACTOR = 1.5;

/** Length of the talk timer in seconds: the chosen minutes, x1.5 when relaxed, halved by the Blitz twist. */
export function talkSeconds(minutes: number, relaxed: boolean, blitz: boolean): number {
    return Math.round((minutes * 60 * (relaxed ? RELAXED_TIME_FACTOR : 1)) / (blitz ? 2 : 1));
}

/** Points are never negative in relaxed mode (and the rules never take points away anyway). */
export const gentlePoints = (points: number, relaxed: boolean): number => (relaxed ? Math.max(0, points) : points);

/** What the one-tap "Relaxat" preset on the setup screen sets. */
export const RELAXED_PRESET = { rx: true, tm: 5, tw: false, troll: false } as const;

/** Scales a vibration pattern down for relaxed mode: shorter pulses, never above 20 ms. */
export function calmVibration(p: number | readonly number[]): number | number[] {
    const soft = (ms: number) => Math.min(20, Math.max(4, Math.round(ms / 2)));
    return typeof p === "number" ? soft(p) : p.map((ms, i) => (i % 2 === 0 ? soft(ms) : ms));
}
