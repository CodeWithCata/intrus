/**
 * Voice host via speechSynthesis (speak, stopVoice, pickVoice).
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { locale } from "#lib/i18n/index.svelte.ts";

/* ===== voice host: reads the starter, the twist and the question aloud ===== */

export const VOICE_SUPPORTED = typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

export let selectedVoice: SpeechSynthesisVoice | null = null;

export const pickVoice = () => {
    try {
        selectedVoice = speechSynthesis.getVoices().find(v => /^ro/i.test(v.lang)) || null;
    }
    catch {
        // best effort: this must never break the game
    }
};
if (VOICE_SUPPORTED) {
    pickVoice();
    try {
        speechSynthesis.addEventListener("voiceschanged", pickVoice);
    }
    catch {
        // best effort: this must never break the game
    }
}

export const stopVoice = () => {
    if (!VOICE_SUPPORTED) {
        return;
    }
    try {
        speechSynthesis.cancel();
    }
    catch {
        // best effort: this must never break the game
    }
};

export const speak = (t?: any, force?: any) => {
    if (!VOICE_SUPPORTED || (!state.vh && !force) || !t) {
        return;
    }
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        // The voice follows the language of the texts: Romanian keeps the voice chosen in pickVoice, another language looks for one of its own.
        u.lang = locale.lang === "en" ? "en-US" : "ro-RO";
        const voice = locale.lang === "ro" ? selectedVoice : speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(locale.lang)) || null;
        if (voice) {
            u.voice = voice;
        }
        u.rate = .95;
        u.volume = 1;
        speechSynthesis.speak(u);
    }
    catch {
        // best effort: this must never break the game
    }
};
