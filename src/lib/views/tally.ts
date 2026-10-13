/**
 * Vote tally logic, shown before the reveal (TallyScreen.svelte). With "Dramatism la vot" on (and not calm) the rows appear one
 * by one, fewest votes first, with a thump and a vibration each; otherwise the counts are simply there.
 */
import { round } from "#lib/stores/ui.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { onEnter, afterRender } from "#lib/stores/nav.svelte.ts";
import { SFX } from "#lib/audio/sfx.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { countUp } from "#lib/animations/count-up.ts";
import { tallyOrder, tallyStep } from "#lib/game/drama.ts";
import { isCalm } from "#lib/utils/calm.ts";

onEnter("tally", () => {
    const counts: Record<number, number> = {};
    round.votes.forEach((v: number) => {
        counts[v] = (counts[v] || 0) + 1;
    });
    const mx = Math.max(...Object.values(counts));
    round.top = Object.keys(counts).filter(k => counts[+k] == mx).map(Number);
    const n = state.players.length;
    const drama = state.dr && !isCalm() ? { order: tallyOrder(counts, n), step: tallyStep(n) } : null;
    if (!drama) {
        SFX.votes();
        vibrate(60);
        afterRender(countUp);
    }
    return { counts, top: round.top, drama };
});
