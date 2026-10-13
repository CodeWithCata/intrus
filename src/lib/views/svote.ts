/**
 * Simultaneous vote logic (SimVoteScreen.svelte). Reached from views/vote.ts when "Mod de vot" is "Simultan" and the device can
 * track enough fingers. The screen puts the votes in `round.votes` and goes to the tally.
 */
import { round } from "#lib/stores/ui.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { onEnter } from "#lib/stores/nav.svelte.ts";

onEnter("svote", () => {
    stopTalkTimer();
    round.votes = [];
    round.pk = null;
    round.anon = true;
});
