/**
 * Quick-add name suggestions for the players sheet: people who played recently (`state.rn`), the last game and
 * saved groups. A short list of common names only fills in while there are fewer than MIN_REAL real names.
 * Names already at the table are left out.
 */
import { state } from "#lib/stores/settings.svelte.ts";

const COMMON = ["Andrei", "Maria", "Alex", "Ioana", "Mihai", "Elena", "Ștefan", "Ana", "Radu", "Cristina", "David", "Diana"];

const key = (s: string) => s.trim().toLocaleLowerCase();

const MIN_REAL = 4;

export function nameSuggestions(max = 12): string[] {
    const used = new Set(state.players.map(p => key(p.n)));
    const out: string[] = [];
    const add = (raw: string | undefined) => {
        const n = (raw ?? "").trim();
        if (n && !used.has(key(n))) {
            used.add(key(n));
            out.push(n);
        }
    };
    state.rn?.forEach(add);
    state.rc?.pl?.forEach(p => add(p.n));
    state.groups.forEach(g => g.pl.forEach(p => add(p.n)));
    if (out.length < MIN_REAL) {
        COMMON.forEach(add);
    }
    return out.slice(0, max);
}
