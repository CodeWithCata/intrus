/**
 * Question mode + voice-host talk intro: a deck of random questions players ask each other
 * during discussion. `questionState` is reactive - QuestionCard.svelte just renders it.
 */
import { locale, t, tr } from "#lib/i18n/index.svelte.ts";
import { questionPool } from "#lib/data/questions.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { playerName } from "#lib/stores/players.svelte.ts";
import { VOICE_SUPPORTED, speak } from "#lib/voice/host.ts";
import { TWISTS } from "#lib/game/twists.ts";
import { PERSONAS } from "#lib/game/twist-rules.ts";
import { round } from "#lib/stores/ui.svelte.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";

/** i = player who asks, d = direction (-1 after the "reverse" twist), q = the current question. */
export const questionState = $state({ i: 0, d: 1, q: "" });

let questionDeck: string[] = [];
let deckLang = "ro";

export function drawQuestion() {
    if (!questionDeck.length || deckLang !== locale.lang) {
        deckLang = locale.lang;
        questionDeck = [...questionPool(locale.lang)].sort(() => Math.random() - .5);
        if (questionDeck[questionDeck.length - 1] === questionState.q) {
            questionDeck.unshift(questionDeck.pop()!);
        }
    }
    questionState.q = questionDeck.pop()!;
}

export const speakQuestion = () => speak(t("spAsks", { name: playerName(questionState.i), q: questionState.q }));

export function nextQuestion() {
    questionState.i = (questionState.i + questionState.d + state.players.length) % state.players.length;
    drawQuestion();
    speakQuestion();
    beep(600, .05);
    vibrate(10);
}

export function redoQuestion() {
    drawQuestion();
    speakQuestion();
    beep(520, .05);
    vibrate(10);
}

export function speakTalkIntro(f?: any) {
    if (!VOICE_SUPPORTED || (!state.vh && !f)) {
        return;
    }
    const tw = TWISTS.find(x => x[0] == round.tw);
    let s = t("spStarts", { name: playerName(round.first) });
    if (tw && tw[2]) {
        s += " " + t("spTwist", { name: tr(tw[1]), desc: tr(tw[2]) });
    }
    if (round.tw == "voc" && round.persona != null) {
        s += " " + t("spPersona", { v: tr(PERSONAS[round.persona]) });
    }
    if (state.qm && questionState.q) {
        s += " " + t("spQuestion", { q: questionState.q });
    }
    speak(s, f);
}

/** "Ascultă din nou" button. */
export function sayTalkIntro() {
    speakTalkIntro(true);
    beep(560, .05);
    vibrate(8);
}

/** Question mode: who asks first and the first question. State only - call before the talk screen is mounted. */
export function prepareTalkQuestions() {
    if (state.qm) {
        questionState.i = round.first;
        questionState.d = round.tw == "rev" ? -1 : 1;
        drawQuestion();
    }
}
