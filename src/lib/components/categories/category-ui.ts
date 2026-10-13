/**
 * Category summaries (plain text over `state`) and the handlers of the categories sheet.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { availableCategories } from "#lib/data/words/index.ts";
import { WORD_COUNTS } from "#lib/data/words/counts.ts";
import { locale, t } from "#lib/i18n/index.svelte.ts";
import { activeCategoryCount } from "#lib/animations/motion.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";

/** The categories on offer in the language of the word lists in use (reactive: it reads `locale.words`). */
export const cats = (): string[] => availableCategories(locale.words);

/** "12 cuvinte" for Romanian; other languages have no stored counts, so no number is shown. */
export const countText = (c: string): string => (locale.words === "ro" ? t("catWords", { n: WORD_COUNTS[c] }) : "");

export const lbl = () => {
    const av = cats();
    const n = state.cats.filter(c => av.includes(c)).length + (state.custom.trim() ? 1 : 0);
    return n === av.length && !state.custom.trim() ? t("catAll") : t("catSelected", { n });
};

export const sum = () => `${t("suPlayersN", { n: state.players.length })} · ${state.k} ${t(state.k > 1 ? "suIntruderMany" : "suIntruderOne")} · ${state.tm ? state.tm + " " + t("suMin") : t("suNoTimer")}`;

export const customWordCount = () => state.custom.split(",").filter(x => x.trim()).length;

export const cuTxt = () => {
    const n = customWordCount();
    return n ? t(n == 1 ? "catWordOne" : "catWords", { n }) : state.cu ? t("cuSeparate") : t("cuAdd");
};

export const catNote = () => {
    const n = activeCategoryCount(), total = cats().length + 1;
    return n >= total ? t("catNoteAll") : n ? t("catNoteSome", { n, total }) : t("catNoteNone");
};

/** Taps a category tile (the pop and sparks are in `CatsSheet`). */
export function toggleCategory(c: string) {
    const on = !state.cats.includes(c);
    state.cats = on ? [...state.cats, c] : state.cats.filter(x => x !== c);
    beep(on ? 660 : 400, on ? .06 : .05);
    vibrate(on ? 20 : 10);
}

/** "Toate" / "Niciuna": the sounds step up tile by tile (the tiles pop in `CatsSheet`, with the same 55 ms stagger). */
export function toggleAllCategories() {
    const av = cats();
    const all = av.every(c => state.cats.includes(c));
    // Categories that exist only in another language keep their state, so switching language back finds the choice as it was.
    state.cats = all ? state.cats.filter(c => !av.includes(c)) : [...new Set([...state.cats, ...av])];
    if (!all) {
        av.forEach((_, i) => setTimeout(() => beep(520 + i * 70, .05), i * 55));
    }
    else {
        beep(360, .08);
    }
    vibrate(all ? 10 : [12, 30, 12]);
}

/** The "Cuvintele tale" tile: shows or hides the custom-words form (pop, sparks and focus are in `CatsSheet`). */
export function toggleCustomWords() {
    state.cu = !state.cu;
    beep(state.cu ? 660 : 400, state.cu ? .06 : .05);
    vibrate(15);
}
