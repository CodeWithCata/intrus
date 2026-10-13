/**
 * "Cuvinte gemene" (twin words) and "Intruși care se cunosc" (known partners): pure helpers.
 * Twin words: civilians get word A, the intruders a similar word B and are NOT told they are intruders (their card looks the same).
 */
import type { Round } from "#lib/game/types.ts";

export type Pair = [string, string];

export interface PoolPair {
    a: string;
    b: string;
    cat: string;
}

/**
 * Picks a pair from the pool (never the same as a recent word when there is a choice) and flips a coin for which word the
 * civilians get. Returns null for an empty pool.
 */
export function pickTwin(pool: readonly PoolPair[], rng: () => number = Math.random, recent: readonly string[] = []): PoolPair | null {
    if (!pool.length) {
        return null;
    }
    const seen = new Set(recent.map(w => w.toLowerCase()));
    const fresh = pool.filter(p => !seen.has(p.a.toLowerCase()) && !seen.has(p.b.toLowerCase()));
    const from = fresh.length ? fresh : pool;
    const p = from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
    return rng() < 0.5 ? { ...p } : { a: p.b, b: p.a, cat: p.cat };
}

/** What player `i` sees on the card: whether it says INTRUS and the word. In twin words nobody is told they are an intruder. */
export function cardFor(r: Pick<Round, "intr" | "troll" | "tn" | "twin" | "word" | "da" | "word2">, i: number): { intruder: boolean; secret: string } {
    if (r.tn) {
        return { intruder: false, secret: !r.troll && r.twin && r.intr.includes(i) ? r.twin : r.word };
    }
    return { intruder: r.intr.includes(i), secret: r.da === i && r.word2 ? r.word2 : r.word };
}

/** The other intruders player `i` is shown on the pass screen ("known partners"); none in a troll round or when the mode is off. */
export function partnersOf(r: Pick<Round, "intr" | "troll" | "kn">, i: number): number[] {
    return r.kn && !r.troll && r.intr.includes(i) ? r.intr.filter(j => j !== i) : [];
}

/** Can the "known partners" switch be used? Needs at least 2 intruders and 6 players. */
export const partnersAvailable = (players: number, intruders: number): boolean => players >= 6 && intruders >= 2;

/** Problems with a list of pairs (empty = fine): identical words, duplicates in either order, cedilla diacritics, blanks. */
export function pairProblems(pairs: readonly Pair[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const [a, b] of pairs) {
        if (!a.trim() || !b.trim() || a !== a.trim() || b !== b.trim()) {
            out.push(`blank or untrimmed: ${a} / ${b}`);
        }
        if (a.toLowerCase() === b.toLowerCase()) {
            out.push(`identical: ${a}`);
        }
        if (/[şţŞŢ]/.test(a + b)) {
            out.push(`cedilla: ${a} / ${b}`);
        }
        const k = [a.toLowerCase(), b.toLowerCase()].sort().join("|");
        if (seen.has(k)) {
            out.push(`duplicate: ${a} / ${b}`);
        }
        seen.add(k);
    }
    return out;
}
