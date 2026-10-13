/**
 * Home/setup screen logic: resets transient state before SetupScreen.svelte is shown (by App.svelte).
 */
import { setHome } from "#lib/stores/ui.svelte.ts";
import { onEnter } from "#lib/stores/nav.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";

onEnter("setup", () => {
    stopTalkTimer();
    state.sheet = null;
    const mx = Math.max(1, (state.players.length - 1) >> 1);
    if (state.k > mx) {
        state.k = mx;
    }
    setHome(true);
});
