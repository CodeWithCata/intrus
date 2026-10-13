/**
 * First-run intro logic: resets transient state before IntroScreen.svelte is shown (by App.svelte;
 * slide texts in components/intro/intro-data.ts, pictures in components/intro/slides/).
 */
import { setHome } from "#lib/stores/ui.svelte.ts";
import { onEnter } from "#lib/stores/nav.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";

onEnter("intro", () => {
    stopTalkTimer();
    state.sheet = null;
    setHome(true);
});
