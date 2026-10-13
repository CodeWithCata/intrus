/**
 * Saved groups: lookup, auto names, intruder-count clamping and the last round result used for
 * rematches.
 */
import type { PlayerStats } from "#lib/game/types.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { displayName } from "#lib/utils/id.ts";

/* ---- Grupuri salvate, revanșă, statistici all-time, răsturnări ---- */

export interface RoundResult {
    /** Outcome code passed to end(). */
    o: number;
    /** Points won by each player index. */
    d: Record<number, number>;
}

export let lastRoundResult: RoundResult | null = null;

export const groupById = (id?: string | null) => state.groups.find(g => g.id === id), currentGroup = () => groupById(state.gid), blankPlayerStats = (): PlayerStats => ({ r: 0, pt: 0, i: 0, c: 0, e: 0, g: 0, vt: 0, vr: 0, w: 0 });

export const autoGroupName = () => {
    const a = state.players.map(displayName);
    return a.slice(0, 2).join(", ") + (a.length > 2 ? " +" + (a.length - 2) : "");
};

export const clampIntruderCount = () => {
    const mx = Math.max(1, (state.players.length - 1) >> 1);
    if (state.k > mx) {
        state.k = mx;
    }
};

export const setLastRoundResult = (v: RoundResult | null) => (lastRoundResult = v);
