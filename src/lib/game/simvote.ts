/**
 * Simultaneous vote ("Vot simultan"): everybody puts a finger on the tile of the player they suspect, at the same time.
 * Pure helpers: whether the mode can be used on this device, which tile a touch is on and how many touches each tile got.
 *
 * The votes are anonymous (nobody can tell which finger belongs to which player), so a round voted this way is marked
 * `round.anon` and the per-voter statistics ("votes cast", "votes that hit an intruder" in game/scoring.ts) are skipped for it.
 */

/** Most players the simultaneous screen supports (fingers on one phone). */
export const SIM_CAP = 6;

export type SimCheck = { ok: true } | { ok: false; reason: "online" | "cap" | "touch" };

/** Can `players` vote at once on this device? The reason is a message key suffix (see i18n `simFallback*`). */
export function simVoteAllowed(players: number, maxTouchPoints: number, online: boolean): SimCheck {
    if (online) {
        return { ok: false, reason: "online" };
    }
    if (players > SIM_CAP) {
        return { ok: false, reason: "cap" };
    }
    if (players > Math.max(0, Math.trunc(maxTouchPoints) || 0)) {
        return { ok: false, reason: "touch" };
    }
    return { ok: true };
}

export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface Point {
    x: number;
    y: number;
}

/** Index of the box that contains the point, or -1. */
export function tileAt(p: Point, boxes: readonly Box[]): number {
    return boxes.findIndex(b => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom);
}

/** Touches per tile. A touch outside every tile counts for nobody. */
export function countTouches(points: Iterable<Point>, boxes: readonly Box[]): number[] {
    const counts = boxes.map(() => 0);
    for (const p of points) {
        const i = tileAt(p, boxes);
        if (i >= 0) {
            counts[i]++;
        }
    }
    return counts;
}

/** The flat `round.votes` list for these counts: player j appears counts[j] times (the tally only counts, order does not matter). */
export function votesFromCounts(counts: readonly number[]): number[] {
    return counts.flatMap((c, j) => Array<number>(c).fill(j));
}
