/**
 * Saving `state` to localStorage. startAutosave() installs ONE effect that re-runs whenever any
 * persisted field changes and writes the result 300 ms later (debounced by the effect cleanup),
 * so nothing has to call a "save" function after editing state. saveStateNow() flushes at once
 * (page hide, leaving the intro).
 *
 * The saved key names are unchanged - saved games from older versions keep loading.
 */
import { STORAGE_KEY } from "#lib/storage/keys.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { round } from "#lib/stores/ui.svelte.ts";
import { nav, MID_ROUND } from "#lib/stores/nav.svelte.ts";
import { talkClock } from "#lib/stores/talk.svelte.ts";

/**
 * The session part of the snapshot: the current round and the screen it is on (`nav`), plus the
 * talk timer's end time. Only written while a round is in progress (a mid-round screen), so it
 * disappears when the round ends or is quit. New keys: round, nav, talkEnd, talkRem.
 */
const session = () => {
    const mid = !!nav.screen && MID_ROUND.includes(nav.screen);
    const talking = mid && nav.screen === "talk";
    return {
        round: mid ? round : undefined,
        nav: mid ? { screen: nav.screen, props: nav.props } : undefined,
        talkEnd: talking ? talkClock.talkEnd : undefined,
        talkRem: talking ? talkClock.talkRem : undefined
    };
};

/** The saved session as plain data (unvalidated), or null. boot() checks it before resuming. */
export const loadSession = (): Record<string, any> | null => {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return s && typeof s === "object" && s.round && s.nav ? s : null;
    }
    catch {
        return null;
    }
};

/** The persisted subset of `state`. Reading it inside an effect subscribes to every field below. */
const snapshot = () => JSON.stringify({ players: state.players, k: state.k, cats: state.cats, tm: state.tm, hint: state.hint, custom: state.custom, cu: state.cu, troll: state.troll, snd: state.snd, vb: state.vb, lite: state.lite, liteSet: state.liteSet, theme: state.theme, acc: state.acc, rv: state.rv, rs: state.rs, rsv: state.rsv, rb: state.rb, cd: state.cd, tk: state.tk, rounds: state.rounds, hist: state.hist, rn: state.rn, seen: state.seen, vol: state.vol, scores: state.scores, last: state.last, groups: state.groups, gid: state.gid, rc: state.rc, sr: state.sr, tw: state.tw, qm: state.qm, vh: state.vh, wl0: state.wl0, dr: state.dr, wh: state.wh, pv: state.pv, vm: state.vm, twn: state.twn, kn: state.kn, rx: state.rx, pty: state.pty, gt: state.gt, cv: state.cv, ...session() });

/** What was last written, so an identical snapshot (e.g. a screen change that alters nothing saved) costs no synchronous storage write. */
let lastWritten: string | null = null;

const write = (json: string, force = false) => {
    if (!force && json === lastWritten) {
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, json);
        lastWritten = json;
    }
    catch {
        // best effort: this must never break the game
    }
};

/** Page hide / leaving the intro: always writes. */
export const saveStateNow = () => write(snapshot(), true);

let stopAutosave: (() => void) | null = null;

export function startAutosave() {
    if (stopAutosave) {
        return;
    }
    stopAutosave = $effect.root(() => {
        $effect(() => {
            const json = snapshot();
            let idle: number | undefined;
            // localStorage.setItem is a synchronous disk write. After the 300 ms debounce it waits for an idle moment
            // (at most 2 s), so it does not land in the middle of a screen entrance or a card flip. A pending write is
            // dropped by the next change; pagehide / visibilitychange flush through saveStateNow().
            const t = setTimeout(() => {
                if (window.requestIdleCallback) {
                    idle = window.requestIdleCallback(() => write(json), { timeout: 2000 });
                }
                else {
                    write(json);
                }
            }, 300);
            return () => {
                clearTimeout(t);
                if (idle !== undefined) {
                    window.cancelIdleCallback?.(idle);
                }
            };
        });
    });
}

/**
 * Asks the browser not to evict the saved data (players, groups, scores, custom word lists, the game
 * in progress) when the device runs low on storage. Fire and forget; a refusal changes nothing. Called
 * once the game is clearly in use (installed, or at least one round played) so that browsers which show
 * a permission prompt (Firefox) do not ask a first-time visitor.
 */
export async function requestDurableStorage(): Promise<boolean> {
    try {
        if (!navigator.storage?.persist) {
            return false;
        }
        return (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
    catch {
        return false;
    }
}
