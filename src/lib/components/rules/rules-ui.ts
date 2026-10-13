/**
 * Rules summary (timer, hint, extras) and the handlers of the rules sheet.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { t } from "#lib/i18n/index.svelte.ts";

export const rv = () => `${state.k} ${t(state.k > 1 ? "suIntruderMany" : "suIntruderOne")} · ${state.tm ? state.tm + " " + t("suMin") : t("suNoTimer")}`;

export const HM = ["cat", "let", "rel", "none"], HL = ["Categorie", "Literă", "Înrudit", "Fără"], HD: Record<string, string> = { cat: "Vede categoria cuvântului", let: "Vede prima literă a cuvântului", rel: "Vede un cuvânt din aceeași categorie", none: "Nu primește niciun indiciu" };

/** Timer choices in minutes (0 = no timer). 1 minute is for short games. */
export const TIMES = [1, 2, 3, 5, 0];

/** Most intruders a table of `n` players allows. */
export const maxIntruders = (n: number) => Math.max(1, Math.floor((n - 1) / 2));

/** The - / + buttons of the intruder stepper (the value's bump is in `RulesSheet`). */
export function stepIntruders(d: number) {
    const mx = maxIntruders(state.players.length);
    state.k = Math.min(mx, Math.max(1, state.k + d));
    beep(520, .05);
    vibrate(10);
}

export function setTimer(min: number) {
    state.tm = min;
    beep(560, .05);
    vibrate(10);
}

export function setHintMode(v: string) {
    state.hint = v;
    beep(560, .05);
    vibrate(10);
}

export function toggleTroll() {
    state.troll = !state.troll;
    beep(state.troll ? 700 : 420, .06);
    vibrate(15);
}

/** "Mod de vot": one by one ("seq") or everybody at once on one screen ("sim"). */
export function setVoteMode(v: "seq" | "sim") {
    state.vm = v;
    beep(560, .05);
    vibrate(10);
}
