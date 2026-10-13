/**
 * Navigation: `nav` says which screen is on show, `go(screen, props?)` changes it. App.svelte is the
 * only thing that renders it. Screens and the views/*.ts logic files never import each other: they
 * call go(). The logic of a screen (sounds, timers, scoring) is an "enter" hook that its views/*.ts
 * file registers with onEnter().
 */
import { stopVoice } from "#lib/voice/host.ts";
import { setHome } from "#lib/stores/ui.svelte.ts";

export type Screen = "intro" | "setup" | "pass" | "talk" | "vote" | "svote" | "tally" | "reveal" | "troll" | "scoreboard" | "online";
export type ScreenProps = Record<string, unknown> | undefined;

/** `n` changes on every go(), so going to the same screen again (pass 0 -> pass 1) renders it afresh. */
export const nav: { screen: Screen | null; props: ScreenProps; n: number } = $state({ screen: null, props: undefined, n: 0 });

/** Runs before the screen is shown. Returns false to cancel (it went elsewhere), or the props to render. */
type Enter = (props: ScreenProps) => ScreenProps | false | void;

const enters: Partial<Record<Screen, Enter>> = {};
let rendered: ScreenProps;
let queue: (() => void)[] = [];

export const onEnter = (screen: Screen, fn: Enter) => {
    enters[screen] = fn;
};

/** Queues work that needs the new screen's DOM (count-up, ...); App.svelte runs it after rendering. */
export const afterRender = (fn: () => void) => {
    queue.push(fn);
};

export const takeAfterRender = () => {
    const q = queue;
    queue = [];
    return q;
};

/** The props to render the current screen with (what the enter hook returned, else what go() got). */
export const screenProps = () => rendered;

export function go(screen: Screen, props?: ScreenProps) {
    stopVoice();
    setHome(false);
    let r: ReturnType<Enter>;
    try {
        r = enters[screen]?.(props);
    }
    catch (e) {
        // A failing enter hook must never leave the player on the old screen: its side effects (the talk countdown and its
        // tick sounds) have usually started already, so the screen would look frozen while the audio plays on.
        console.error(`[nav] the enter hook of "${screen}" failed`, e);
        r = undefined;
    }
    if (r === false) {
        return;
    }
    rendered = r || props;
    nav.screen = screen;
    nav.props = props;
    nav.n++;
}

/** Screens that are part of a round: the ones a saved game can resume. */
export const MID_ROUND: Screen[] = ["pass", "talk", "vote", "svote", "tally", "reveal", "troll"];
