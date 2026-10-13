/**
 * Discussion logic. The countdown lives in stores/talk.svelte.ts and the components bind to it;
 * this only starts it. `props.resume` (set when a saved game is restored) keeps the timer that
 * boot() already restarted from its saved end time. The opening wheel (`wheel` prop) is shown only for a fresh round and only
 * when effects are allowed (not relaxed mode or reduced motion; it does run in lite mode, see utils/calm.ts); it then announces who starts when it has stopped.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { round } from "#lib/stores/ui.svelte.ts";
import { onEnter, afterRender } from "#lib/stores/nav.svelte.ts";
import { prepareTalkQuestions, speakTalkIntro } from "#lib/game/questions.svelte.ts";
import { cineLoad } from "#lib/audio/cinematic.ts";
import { startTalkTimer, stopTalkTimer, talkClock } from "#lib/stores/talk.svelte.ts";
import { talkSeconds } from "#lib/game/relaxed.ts";
import { wheelAllowed } from "#lib/utils/calm.ts";

onEnter("talk", props => {
    const resume = !!props?.resume;
    const wheel = !resume && state.players.length >= 2 && state.wh && wheelAllowed();
    // Everything that can fail runs before the countdown starts: once it runs, its tick sounds play whether or not the screen opens.
    prepareTalkQuestions();
    if (!resume) {
        if (state.tm) {
            startTalkTimer(talkSeconds(state.tm, state.rx, round.tw == "blitz"));
        }
        else {
            stopTalkTimer();
            talkClock.talkEnd = 0;
            talkClock.talkRem = 0;
        }
    }
    afterRender(() => {
        if (!resume && !wheel) {
            speakTalkIntro();
        }
        if (state.tk === "cine") {
            cineLoad();
        }
    });
    return { ...props, resume, wheel };
});
