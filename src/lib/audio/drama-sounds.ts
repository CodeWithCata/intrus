/**
 * Sounds of the vote drama, the opening wheel and the last seconds. Everything goes through tone() / hiss(), which return
 * silently when sound is off (state.snd), so these need no checks of their own.
 */
import { tone } from "#lib/audio/tone.ts";
import { hiss } from "#lib/audio/noise.ts";

/** A drumroll of `ms` milliseconds: soft taps that get closer together and louder, ending just before the reveal. */
export function dramaRoll(ms = 900) {
    const taps = Math.max(6, Math.round(ms / 60));
    for (let i = 0; i < taps; i++) {
        const k = i / (taps - 1), at = (ms / 1000) * (1 - Math.pow(1 - k, 1.6));
        tone(95 + k * 25, 0.07, { v: 0.1 + k * 0.16, at, a: 0.002, lp: 420 });
        hiss(0.02, { f: 1400, q: 1, v: 0.025 + k * 0.05, at, a: 0.002 });
    }
}

/** One tally row appearing: a short low thump that rises a little each time (`i` = how many rows are already in). */
export function dramaHit(i = 0) {
    tone(110 + Math.min(i, 8) * 12, 0.12, { v: 0.2, a: 0.003, lp: 600, to: 80, sd: 0.1 });
}

/** The fake-out being undone: a falling "womp" and a short rising sweep. */
export function dramaFlip() {
    tone(260, 0.35, { t: "triangle", to: 90, sd: 0.3, v: 0.2, lp: 700 });
    hiss(0.18, { f: 600, to: 2600, q: 0.8, v: 0.06, a: 0.1, at: 0.05 });
}

/** The fake-out itself: a bright stinger that sounds like "got him". */
export function dramaFake() {
    tone(523, 0.18, { v: 0.12, lp: 2500 });
    tone(659, 0.3, { v: 0.1, at: 0.1, lp: 2500 });
}

/** One slice passing the pointer of the opening wheel. `k` goes from 0 (fast) to 1 (stopping): lower and longer at the end. */
export function wheelTick(k = 0) {
    tone(900 - k * 380, 0.04 + k * 0.05, { t: "square", v: 0.05 + k * 0.05, a: 0.001, lp: 2200 });
}

/** The wheel stopping on its player. */
export function wheelStop() {
    tone(392, 0.4, { v: 0.14, lp: 1800, r: 0.2 });
    tone(587, 0.5, { v: 0.09, at: 0.08, lp: 1800, r: 0.2 });
}

/** The last seconds begin (the dimming starts): two short falling notes, clearly different from a tick, over before the next second. */
export function lowAlert() {
    tone(880, 0.12, { t: "triangle", v: 0.15, lp: 2600, a: 0.004 });
    tone(587, 0.2, { t: "triangle", v: 0.13, at: 0.13, lp: 2200, a: 0.004 });
}
