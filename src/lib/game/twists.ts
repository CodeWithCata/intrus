/**
 * Round twists (whisper, reverse order, double agent, extra intruder, ...): TWISTS table,
 * and maybeApplyTwist() (40% chance). The twist card/note are components/game/TwistCard + TwistNote.
 */
import type { Round } from "#lib/game/types.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { relatedWords } from "#lib/stores/wordlists.svelte.ts";
import { pickTwist } from "#lib/game/twist-rules.ts";

export const TWISTS = ([["sopt", "Șoptit", "Toată discuția se face în șoaptă."], ["rev", "Sens invers", "După cel care începe, mergeți în partea opusă."], ["rep", "Fără repetiții", "Un cuvânt spus nu mai poate fi spus de altcineva."], ["adj", "Doar adjective", "Descrieți cartea doar cu adjective."], ["mima", "Mimă", "Fără cuvinte: arătați cartea doar prin gesturi."], ["blitz", "Blitz", "Timpul de discuție se înjumătățește."], ["dbl", "Dublu sau nimic", "Punctele din runda asta se dublează."], ["ag", "Agent dublu"], ["ex", "Intrus în plus"]] as any[][]);

export function maybeApplyTwist(g: Round, n: number) {
    if (!state.tw || g.troll) {
        return;
    }
    const civ = [...Array(n).keys()].filter(i => !g.intr.includes(i)), sib = relatedWords(g.cat, g.word);
    const t = pickTwist({ last: state.ltw || null, questions: !!state.qm, timer: !!state.tm, twin: !!g.tn, players: n, intruders: g.intr.length, related: sib.length });
    if (!t) {
        return;
    }
    g.tw = t;
    state.ltw = t;
    if (t == "ex") {
        g.intr.push(civ[Math.random() * civ.length | 0]);
    }
    if (t == "ag") {
        g.da = civ[Math.random() * civ.length | 0];
        g.word2 = sib[Math.random() * sib.length | 0];
    }
}
