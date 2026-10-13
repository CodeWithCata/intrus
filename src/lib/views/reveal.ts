/**
 * Reveal logic: who the intruder(s) were; the outcome picker (RevealScreen.svelte) calls end().
 * The "everybody is an intruder" round goes to the "troll" screen (TrollRevealScreen.svelte).
 * With "Dramatism la vot" on (and not calm) the screen plays a short build-up first (components/game/RevealDrama.svelte);
 * the sound and vibration of the reveal then belong to its last step. The plan only decorates: `caught`, `rec` and the
 * outcomes are worked out from the real round here and never from the fake-out.
 */
import { screenShake } from "#lib/animations/motion.ts";
import { round } from "#lib/stores/ui.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { go, onEnter } from "#lib/stores/nav.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { SFX } from "#lib/audio/sfx.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { planReveal } from "#lib/game/drama.ts";
import { isCalm } from "#lib/utils/calm.ts";

onEnter("reveal", () => {
    stopTalkTimer();
    if (round.troll) {
        setTimeout(screenShake, 330);
        go("troll");
        return false;
    }
    const caught = !!(round.top && round.top.length === 1 && round.intr.includes(round.top[0]));
    // Recommended outcome: 0 = caught, 2 = escaped, -1 = nobody voted (revealed directly).
    const rec = round.top ? (caught ? 0 : 2) : -1;
    const plan = planReveal({ calm: isCalm(), troll: round.troll, n: state.players.length, intr: round.intr, drama: state.dr });
    if (plan.steps.length === 1) {
        setTimeout(screenShake, 330);
        SFX.intrus();
        vibrate([80, 60, 80]);
    }
    return { round, caught, rec, mult: round.tw == "dbl" ? 2 : 1, plan: plan.steps.length > 1 ? plan : null };
});

onEnter("troll", () => {
    SFX.troll();
    vibrate([80, 60, 80]);
    return { word: round.word, twin: !!round.tn };
});
