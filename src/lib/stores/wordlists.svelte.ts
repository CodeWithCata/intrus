/**
 * Custom word lists (saved per group), custom words ("word|category|hint") parsing, and the
 * handlers of the categories / list-name sheets.
 */
import type { Group, GroupWordList } from "#lib/game/types.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import { currentGroup } from "#lib/stores/groups.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { ask } from "#lib/stores/ask.svelte.ts";
import { uniqueId } from "#lib/utils/id.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { SFX } from "#lib/audio/sfx.ts";
import { customWordCount } from "#lib/components/categories/category-ui.ts";
import { CATEGORIES, cachedWords } from "#lib/data/words/index.ts";

/* ===== custom word lists, saved per group ===== */

export const currentWordLists = () => {
    const g = currentGroup();
    if (g) {
        if (!Array.isArray(g.wl)) {
            g.wl = [];
        }
        return g.wl;
    }
    return state.wl0;
};

/** The lists to show: like currentWordLists() but never creates anything, so it is safe inside templates. */
export const readWordLists = (): GroupWordList[] => {
    const g = currentGroup();
    return g ? (Array.isArray(g.wl) ? g.wl : []) : state.wl0;
};

export const wordCount = (l: GroupWordList) => l.w.split(",").filter((x) => x.trim()).length;

export const autoListName = () => t("lsAuto", { n: readWordLists().length + 1 });

export const applyGroupList = (g: Group) => {
    const l = (g.wl || []).find((x) => x.id === g.lu);
    if (l) {
        state.custom = l.w;
        state.cu = true;
    }
};

/** "Adaugă cuvântul": appends the word being typed to the custom words. Returns false (and buzzes) when the word field is empty. */
export function addCustomWord(): boolean {
    const cl = (s: unknown) => String(s || "").replace(/[,|]/g, " ").replace(/\s+/g, " ").trim(), e = { w: cl(state.nw), c: cl(state.nc), h: cl(state.nh) };
    if (!e.w) {
        SFX.err();
        vibrate([40, 40]);
        return false;
    }
    state.custom = (state.custom.trim().replace(/,\s*$/, "") + (state.custom.trim() ? ", " : "") + formatCustomWord(e));
    state.cu = true;
    state.nw = "";
    state.nh = "";
    beep(660, .06);
    vibrate(15);
    return true;
}

export function removeCustomWord(i: number) {
    const E = parseCustomWords();
    E.splice(i, 1);
    state.custom = E.map(formatCustomWord).join(", ");
    beep(380, .05);
    vibrate(10);
}

/** "Salvează lista curentă": asks for a name. */
export function newWordList() {
    if (!customWordCount()) {
        return;
    }
    state.ln = "";
    state.sheet = "lname";
    beep(560, .05);
    vibrate(10);
}

export function saveWordList() {
    const L = currentWordLists(), w = state.custom.split(",").map(s => s.trim()).filter(Boolean).join(", ");
    if (!w) {
        return;
    }
    const nm = (state.ln || "").trim() || autoListName(), ex = L.find(l => l.nm.toLowerCase() == nm.toLowerCase());
    let id;
    if (ex) {
        ex.w = w;
        id = ex.id;
    }
    else {
        id = uniqueId();
        L.push({ id, nm, w });
    }
    const g = currentGroup();
    if (g) {
        g.lu = id;
    }
    state.ln = "";
    state.sheet = "cats";
    beep(660, .06);
    vibrate(15);
}

export function useWordList(id: string) {
    const l = currentWordLists().find(x => x.id === id);
    if (!l) {
        return;
    }
    state.custom = l.w;
    state.cu = true;
    const g = currentGroup();
    if (g) {
        g.lu = id;
    }
    beep(620, .06);
    vibrate(12);
}

export function deleteWordList(id: string) {
    const l = currentWordLists().find(x => x.id === id);
    if (!l) {
        return;
    }
    ask(t("wlDeleteAsk"), t("wlDeleteDesc", { name: l.nm }), t("grDeleteYes"), () => {
        const L = currentWordLists(), i = L.findIndex(x => x.id === id);
        if (i > -1) {
            L.splice(i, 1);
        }
        const g = currentGroup();
        if (g && g.lu === id) {
            delete g.lu;
        }
        state.sheet = "cats";
    });
}

/* ===== custom words with their own category + hint: "cuvânt|categorie|indiciu" ===== */

export const parseCustomWords = () => state.custom.split(",").map(s => s.trim()).filter(Boolean).map(s => {
    const [w, c, h] = s.split("|").map(x => (x || "").trim());
    return { w: w || "", c: c || "", h: h || "" };
}).filter(e => e.w);

export const formatCustomWord = (e?: any) => e.w + (e.c || e.h ? "|" + e.c : "") + (e.h ? "|" + e.h : "");

export const customWordCategory = (e?: any) => CATEGORIES.find(k => k.toLowerCase() == e.c.toLowerCase()) || e.c || "Personalizat";

/** "word|category" -> custom entry of the round being started (hint lookup). Plain lookup table, not UI state. */
export const customEntries: Record<string, any> = {};

export const clearCustomEntries = () => {
    for (const k of Object.keys(customEntries)) {
        delete customEntries[k];
    }
};

export const relatedWords = (cat?: any, word?: any) => cachedWords(cat) ? cachedWords(cat)!.filter(x => x !== word) : parseCustomWords().filter(e => customWordCategory(e).toLowerCase() == String(cat).toLowerCase() && e.w !== word).map(e => e.w);
