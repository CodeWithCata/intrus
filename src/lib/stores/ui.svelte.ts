/**
 * Current round data (`round`, reactive), setHome() and focusScreenHeading() (called by App.svelte
 * after every screen change).
 */
import { appEl } from "#lib/stores/settings.svelte.ts";
import type { Round } from "#lib/game/types.ts";

/** The current round. One reactive object for the whole app: resetRound() replaces its contents in place. */
export const round: Round = $state({} as Round);

export const setHome = (on?: any) => {
    document.body.classList.toggle("home", on);
    document.documentElement.classList.toggle("is-home", on);
};

/**
 * Moves keyboard / screen-reader focus to the new screen's heading, so a screen change is
 * announced and the next Tab starts at the top of the new screen. The heading is not a control:
 * it only gets tabindex="-1" (focusable by script, not part of the Tab order). A screen with no
 * <h1> marks its title with role="heading" aria-level="1"; the intro falls back to its first <h2>.
 */
export const focusScreenHeading = () => {
    if (appEl.hasAttribute("inert")) {
        return; // a bottom sheet is open (it makes #app inert) and owns the focus
    }
    const h = appEl.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"], h2');
    if (!h) {
        return;
    }
    if (!h.hasAttribute("tabindex")) {
        h.tabIndex = -1;
    }
    h.focus({ preventScroll: true });
};

/** Starts a new round: drops every field of the previous one, then copies `v` in. */
export const resetRound = (v: Round) => {
    for (const k of Object.keys(round)) {
        Reflect.deleteProperty(round, k);
    }
    Object.assign(round, v);
};
