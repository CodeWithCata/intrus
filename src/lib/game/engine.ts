/**
 * Round lifecycle. start() picks word + intruders (and twist) and opens the pass screen;
 * end(outcome) adds points, shows the scoreboard (ScoreboardScreen.svelte), unlocks designs.
 */
import { rememberNames } from "#lib/stores/recent-names.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { OPTIONAL_PACKS, cachedWords, getWordLang, hasWords, isLoaded, loadWords } from "#lib/data/words/index.ts";
import { cachedPairs, hasPairs, loadPairs, pairsLoaded } from "#lib/data/words/pairs/index.ts";
import { partnersAvailable, pickTwin } from "#lib/game/twins.ts";
import { gentlePoints } from "#lib/game/relaxed.ts";
import { locale, t } from "#lib/i18n/index.svelte.ts";
import { catName } from "#lib/data/category-names.ts";
import { customEntries, clearCustomEntries, customWordCategory, parseCustomWords, relatedWords } from "#lib/stores/wordlists.svelte.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { SFX } from "#lib/audio/sfx.ts";
import { round, resetRound } from "#lib/stores/ui.svelte.ts";
import { maybeApplyTwist } from "#lib/game/twists.ts";
import { pickIntruders } from "#lib/game/intruders.ts";
import { go, afterRender } from "#lib/stores/nav.svelte.ts";
import { CARD_DESIGNS } from "#lib/data/card-designs.ts";
import { currentGroup, setLastRoundResult } from "#lib/stores/groups.svelte.ts";
import { recordRoundStats } from "#lib/game/scoring.ts";
import { countUp } from "#lib/animations/count-up.ts";
import { confetti } from "#lib/components/game/confetti.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { openSheet } from "#lib/components/ui/sheets.ts";
import { nudge } from "#lib/components/categories/nudge.svelte.ts";

/**
 * Starts a round. The word lists are separate chunks, so the selected ones are fetched first; when
 * they are already cached (the usual case, see preloadWords in boot) this runs synchronously.
 */
export function start() {
    const missing = activeCats().filter(c => !isLoaded(c));
    const missingPairs = twinsOn() ? activeCats().filter(c => hasPairs(c) && !pairsLoaded(c)) : [];
    if (!missing.length && !missingPairs.length) {
        beginRound();
        return;
    }
    Promise.all([loadWords(missing), loadPairs(missingPairs)]).then(beginRound, () => {
        toast(t("enLoadFail"));
        SFX.err();
    });
}

/** The selected categories that may be used: an optional pack (Petrecere) only counts while its switch is on, and a category needs a list in the chosen language. */
function activeCats(): string[] {
    return state.cats.filter(c => hasWords(c) && (!(c in OPTIONAL_PACKS) || state[OPTIONAL_PACKS[c]]));
}

/** "Cuvinte gemene" needs the twin pairs, which exist in Romanian only for now: in another language the round uses single words. */
function twinsOn(): boolean {
    return !!state.twn && getWordLang() === "ro";
}

function beginRound() {
    const pool: [string, string][] = [];
    activeCats().forEach(c => (cachedWords(c) || []).forEach(w => pool.push([w, c])));
    clearCustomEntries();
    (state.cu ? parseCustomWords() : []).forEach(e => {
        const c = customWordCategory(e);
        pool.push([e.w, c]);
        customEntries[e.w.toLowerCase() + "|" + c] = e;
    });
    if (!pool.length) {
        state.sheet = "cats";
        vibrate([40, 40]);
        SFX.err();
        setTimeout(() => nudge.n++, 80);
        return;
    }
    const hl = Math.max(0, Math.min(30, pool.length - 1));
    const hs = state.hist.slice(-hl);
    const seen = new Set(hs.map(w => w.toLowerCase()));
    let fresh = pool.filter(([w]) => !seen.has(w.toLowerCase()));
    while (!fresh.length && hs.length) {
        hs.shift();
        const z = new Set(hs.map(w => w.toLowerCase()));
        fresh = pool.filter(([w]) => !z.has(w.toLowerCase()));
    }
    if (!fresh.length) {
        fresh = pool;
    }
    const pick = fresh[Math.random() * fresh.length | 0], n = state.players.length;
    let word = pick[0], cat = pick[1], twin: string | undefined;
    if (twinsOn()) {
        // "Cuvinte gemene": civilians get word A of a pair, the intruders the similar word B (and are not told)
        const pairPool = activeCats().filter(hasPairs).flatMap(c => cachedPairs(c).map(([a, b]) => ({ a, b, cat: c })));
        const tw = pickTwin(pairPool, Math.random, hs);
        if (tw) {
            word = tw.a;
            cat = tw.cat;
            twin = tw.b;
        }
        else {
            toast(t("twNoPairs"));
        }
    }
    state.hist = [...hs, word].slice(-30);
    const intr = pickIntruders([...Array(n).keys()], state.last, state.k);
    const troll = state.troll && n >= 4 && Math.random() < .2;
    if (troll) {
        intr.length = 0;
        for (let i = 0; i < n; i++) {
            intr.push(i);
        }
    }
    state.last = troll ? [] : intr;
    state.players.forEach((_, i) => {
        state.scores[i] = state.scores[i] || 0;
    });
    // "Intruși care se cunosc": needs 2+ intruders and 6+ players, never together with twin words or in a troll round
    const kn = !troll && !twin && state.kn && partnersAvailable(n, intr.length);
    resetRound({ word, cat, intr, troll, first: Math.random() * n | 0, votes: [], hint: "", tw: null, tn: !!twin, twin, kn });
    maybeApplyTwist(round, n);
    rememberNames();
    state.rc = { gid: state.gid, k: state.k, pl: state.players.map(p => ({ ...p })) };
    if (state.hint !== "none") {
        const rel = relatedWords(cat, word), ce = customEntries[word.toLowerCase() + "|" + cat];
        round.hint = ce && ce.h ? t("hnHint", { h: ce.h }) : state.hint == "rel" && rel.length ? t("hnRel", { w: rel[Math.random() * rel.length | 0] }) : state.hint == "cat" && (cachedWords(cat) || cat != "Personalizat") ? t("hnCat", { cat: catName(cat, locale.words) }) : t("hnLetter", { l: word[0].toUpperCase() });
    }
    go("pass", { i: 0 });
}

export function end(o: number) {
    const r0 = state.rounds;
    state.rounds++;
    const nu = CARD_DESIGNS.filter(d => d[2] > r0 && d[2] <= state.rounds);
    const d: Record<number, number> = {};
    state.players.forEach((_, i) => {
        const I = round.intr.includes(i);
        d[i] = (o == 0 && !I) ? 1 : (o == 1 && I) ? 1 : (o == 2 && I) ? 2 : 0;
        d[i] *= round.tw == "dbl" ? 2 : 1;
        d[i] = gentlePoints(d[i], state.rx);
        state.scores[i] += d[i];
    });
    state.sr++;
    setLastRoundResult({ o, d });
    if (currentGroup()) {
        recordRoundStats(o, d);
    }
    const r = state.players.map((_, i) => i).sort((a, b) => state.scores[b] - state.scores[a]);
    go("scoreboard", { order: r, gain: d });
    SFX.win();
    afterRender(countUp);
    setTimeout(confetti, 450);
    if (nu.length) {
        setTimeout(() => toast("Design nou deblocat: " + nu.map(d => d[1]).join(", "), { action: "Vezi", onaction: () => openSheet("set") }), 1500);
    }
}
