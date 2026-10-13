/**
 * Who is the intruder this round. Pure (no stores, no I/O), so it is unit-tested directly.
 *
 * A player who was an intruder LAST round is less likely to be picked again, but not excluded: their weight is
 * REPEAT_WEIGHT (a third of everyone else's). A hard exclusion would let the table rule that player out, which in a
 * small group is a real shortcut for finding the intruder. With the soft rule a repeat is rare but still possible,
 * so nobody can be ruled out, and nobody gets a long streak either. Several intruders are drawn without replacement.
 */
export const REPEAT_WEIGHT = 1 / 3;

/**
 * Picks up to `count` distinct items out of `ids`. Items listed in `last` get REPEAT_WEIGHT, the others 1.
 * `rng` returns a number in [0, 1). Returns fewer than `count` only if there are fewer candidates.
 */
export function pickIntruders<T>(ids: readonly T[], last: readonly T[], count: number, rng: () => number = Math.random): T[] {
  const left = ids.map((id) => ({ id, w: last.includes(id) ? REPEAT_WEIGHT : 1 }));
  const out: T[] = [];
  while (out.length < count && left.length) {
    const total = left.reduce((sum, c) => sum + c.w, 0);
    let r = rng() * total;
    let at = left.findIndex((c) => (r -= c.w) < 0);
    if (at < 0) at = left.length - 1; // floating-point edge: r landed exactly on the total
    out.push(left[at].id);
    left.splice(at, 1);
  }
  return out;
}
