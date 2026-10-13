/**
 * The single game/settings object `state`: a deep `$state` proxy, so components and effects react to
 * every change (persisted to localStorage by storage/persist.svelte.ts). Loaded + normalised at import time. Also holds the #app element reference (set by initAppEl in boot).
 */
import type { State } from "#lib/game/types.ts";
import { CATEGORIES, migrateCats } from "#lib/data/words/index.ts";
import { STORAGE_KEY } from "#lib/storage/keys.ts";
import { saveStateNow } from "#lib/storage/persist.svelte.ts";

export const state: State = $state({ players: [0, 1, 2].map(a => ({ n: "", a })), k: 1, cats: [...CATEGORIES], tm: 3, hint: "cat", vol: .75, ol: 0, code: "", custom: "", cu: false, troll: false, snd: true, vb: true, lite: false, theme: "light", acc: "#D8002B", rv: "flip", rs: "soapta", rb: "tick", cd: "classic", tk: "clock", rounds: 0, hist: [], seen: false, scores: {}, last: [], sheet: null, groups: [], gid: null, rc: null, sr: 0, tw: true, gn: "", ge: null, gv: null, gfrom: false, qm: false, vh: false, wl0: [], ln: "", nw: "", nc: "", nh: "", dr: true, pv: false, vm: "seq", twn: false, kn: false, rx: false, pty: false, gt: true, wh: true, cv: 2 });
try {
    const o = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (o.players && o.players.length >= 3) {
        Object.assign(state, o);
    }
}
catch {
        // best effort: this must never break the game
    }
/* touch phones default to the light (no heavy animation) mode until the player picks a setting themselves */
if (!Array.isArray(state.groups)) {
    state.groups = [];
}
if (!Array.isArray(state.rn)) {
    state.rn = [];
}
if (!Array.isArray(state.wl0)) {
    state.wl0 = [];
}
state.ln = "";
if (state.tw === undefined) {
    state.tw = true;
}
state.sr = state.sr || 0;
state.gn = "";
state.ge = null;
if (!state.liteSet) {
    state.lite = matchMedia("(hover:none),(pointer:coarse),(max-width:820px)").matches || navigator.maxTouchPoints > 0;
}
if (state.hint === true) {
    state.hint = "cat";
}
else if (state.hint === false) {
    state.hint = "none";
}
state.ol = 0;
/* v2 settings: every one has a default, so saved games from before keep loading */
const saved = (() => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    }
    catch {
        return {};
    }
})();
state.dr = state.dr !== false;
state.wh = state.wh !== false; // saved games from before the switch existed keep the wheel
state.gt = state.gt !== false;
state.vm = state.vm === "sim" ? "sim" : "seq";
state.twn = state.twn === true;
state.kn = state.kn === true;
state.rx = state.rx === true;
state.pty = state.pty === true;
/* the privacy guard is on by default on touch devices; a saved choice always wins */
state.pv = typeof saved.pv === "boolean" ? saved.pv : (matchMedia("(hover:none),(pointer:coarse)").matches || navigator.maxTouchPoints > 0);
/* twin words and known partners cannot be on together (the intruders of twin words do not know they are intruders) */
if (state.twn && state.kn) {
    state.kn = false;
}
/* new word packs: players who had every older category selected get the new ones too */
state.cats = migrateCats(state.cats, +state.cv || 1);
state.cv = 2;
if (!Array.isArray(state.hist)) {
    state.hist = [];
}
if (!["off", "soapta", "murmur", "suflu", "vant", "fosnet", "suier", "carte", "clic", "lacat", "puls", "sonar", "bas"].includes(state.rs) || (!state.rsv && state.rs === "carte")) {
    state.rs = "soapta";
}
state.rsv = 1;
addEventListener("pagehide", saveStateNow);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        saveStateNow();
    }
});

export let appEl: HTMLElement;

export const initAppEl = () => {
    appEl = document.getElementById("app")!;
};
