/**
 * The staged vote reveal (feature "Votul cu dramatism") and the "alarmă falsă" fake-out. Pure: no stores, no DOM, no audio,
 * so the order of the steps and the fake-out rules are unit-tested directly. Components (views/TallyScreen, components/game/RevealDrama)
 * play a plan with runPlan() and attach sound / vibration / visuals to each step.
 *
 * The fake-out is purely visual. The real result (round.intr, round.top, the outcome picked on the reveal screen) is never
 * read from, or changed by, anything in this file: planReveal() only *adds* a visual detour before the real result.
 */

/** One thing that happens during the reveal. `at` is the delay (ms) from the start of the plan. */
export interface DramaStep {
    kind: "roll" | "fake" | "flip" | "reveal";
    at: number;
    /** Player index shown by a "fake" step (never an intruder). */
    target?: number;
}

export interface RevealPlan {
    steps: DramaStep[];
    /** The innocent player the reveal pretends to point at first, or null. */
    fake: number | null;
    /** When the real result is on screen (ms from the start). Always <= MAX_DRAMA_MS. */
    totalMs: number;
}

/** About 1 reveal in 4 starts with a fake-out. */
export const FAKE_CHANCE = 0.25;
/** The information is never held back longer than this (ms) on one screen. */
export const MAX_DRAMA_MS = 3000;
/** The tally rows appear one by one within this time (ms). */
export const TALLY_MS = 1800;

export interface PlanOptions {
    /** Lite mode, reduced motion or relaxed mode: a quick, still-correct reveal. */
    calm: boolean;
    troll: boolean;
    /** Number of players. */
    n: number;
    /** The real intruders. */
    intr: readonly number[];
    /** Random numbers in [0, 1); injected so tests are deterministic. */
    rng?: () => number;
    /** Set to false to switch the whole thing off ("Dramatism la vot" off). */
    drama?: boolean;
}

/** Picks an innocent player (never an intruder). Null when everybody is an intruder. */
export function pickFake(n: number, intr: readonly number[], rng: () => number = Math.random): number | null {
    const innocents: number[] = [];
    for (let i = 0; i < n; i++) {
        if (!intr.includes(i)) {
            innocents.push(i);
        }
    }
    return innocents.length ? innocents[Math.min(innocents.length - 1, Math.floor(rng() * innocents.length))] : null;
}

/** Whether this reveal gets a fake-out: never in a troll round, never when calm, otherwise FAKE_CHANCE. */
export function shouldFake(o: PlanOptions, rng: () => number = Math.random): boolean {
    if (o.calm || o.troll || o.drama === false || o.n < 3 || !o.intr.length || o.intr.length >= o.n) {
        return false;
    }
    return rng() < FAKE_CHANCE;
}

/**
 * The steps of one reveal. Calm / switched off: one "reveal" step at 0 ms. Otherwise a drumroll, then (sometimes) the fake
 * pick and its flip, then the real result.
 */
export function planReveal(o: PlanOptions): RevealPlan {
    const rng = o.rng ?? Math.random;
    if (o.calm || o.drama === false) {
        return { steps: [{ kind: "reveal", at: 0 }], fake: null, totalMs: 0 };
    }
    const fake = shouldFake(o, rng) ? pickFake(o.n, o.intr, rng) : null;
    if (fake === null) {
        return { steps: [{ kind: "roll", at: 0 }, { kind: "reveal", at: 1400 }], fake: null, totalMs: 1400 };
    }
    return {
        steps: [{ kind: "roll", at: 0 }, { kind: "fake", at: 800, target: fake }, { kind: "flip", at: 1900 }, { kind: "reveal", at: 2300 }],
        fake,
        totalMs: 2300
    };
}

/** Player indexes in the order their vote count is shown: fewest votes first, the most voted last (ties by seat). */
export function tallyOrder(counts: Readonly<Record<number, number>>, n: number): number[] {
    return [...Array(n).keys()].sort((a, b) => (counts[a] || 0) - (counts[b] || 0) || a - b);
}

/** Delay (ms) between two tally rows so that all `n` rows are in within `budget` ms (at most 450 ms apart). */
export function tallyStep(n: number, budget: number = TALLY_MS): number {
    return n > 0 ? Math.min(450, Math.floor(budget / n)) : 0;
}

export interface Timers {
    set: (fn: () => void, ms: number) => unknown;
    clear: (id: unknown) => void;
}

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

/**
 * Plays the steps with timers and calls `on` for each one, in order. Returns a function that stops the rest (and, when
 * `finish` is true, immediately plays the final "reveal" step if it has not run yet, so a skipped drama is still correct).
 */
export function runPlan(steps: readonly DramaStep[], on: (s: DramaStep) => void, timers: Timers = realTimers): (finish?: boolean) => void {
    const ids: unknown[] = [];
    let done = false;
    const last = steps[steps.length - 1];
    const play = (s: DramaStep) => {
        if (s === last) {
            done = true;
        }
        on(s);
    };
    for (const s of steps) {
        if (s.at <= 0) {
            play(s);
        }
        else {
            ids.push(timers.set(() => play(s), s.at));
        }
    }
    return (finish = false) => {
        ids.forEach(id => timers.clear(id));
        ids.length = 0;
        if (finish && !done && last) {
            play(last);
        }
    };
}
