/**
 * The names of players who played recently (`state.rn`, most recent first, saved in the browser).
 * Filled when a round starts; read by the quick-add chips of the players sheet.
 */
import { state } from "#lib/stores/settings.svelte.ts";

const MAX_RECENT = 30;

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Puts the current table's names at the front of the recent list (custom names only, no "Jucător 3" defaults). */
export function rememberNames() {
    const names = state.players.map(p => p.n.trim()).filter(Boolean);
    const rest = (state.rn ?? []).filter(o => !names.some(n => same(n, o)));
    state.rn = [...names.filter((n, i) => names.findIndex(o => same(o, n)) === i), ...rest].slice(0, MAX_RECENT);
}
