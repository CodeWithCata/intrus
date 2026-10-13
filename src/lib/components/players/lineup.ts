/**
 * Which of the player pips light up for the current number of intruders.
 */
import { state } from "#lib/stores/settings.svelte.ts";

/** Indices of the pips that stand for intruders, spread evenly along the line-up. */
export const lineupOn = (): Set<number> => {
    const n = state.players.length, t = new Set<number>();
    for (let j = 0; j < state.k; j++) {
        t.add(Math.floor((j + .5) * n / state.k));
    }
    return t;
};
