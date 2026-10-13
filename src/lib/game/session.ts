/**
 * Session-level actions shared by several screens: leaving a round, starting a new game,
 * rematch. Components import these directly and call them from `onclick`.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { ask } from "#lib/stores/ask.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { closeSeries } from "#lib/game/scoring.ts";
import { clampIntruderCount, groupById } from "#lib/stores/groups.svelte.ts";
import { start } from "#lib/game/engine.ts";
import { go } from "#lib/stores/nav.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";

export function quitRound() {
    ask(t("sqQuit"), t("sqQuitDesc"), t("sqQuitYes"), () => {
        stopTalkTimer();
        go("setup");
    });
}

export function newGame() {
    ask(t("sqNew"), t("sqNewDesc"), t("sqNewYes"), () => {
        closeSeries();
        go("setup");
    });
}

export function rematch() {
    closeSeries();
    const r = state.rc;
    if (r && r.pl) {
        state.players = r.pl.map(p => ({ ...p }));
        state.gid = r.gid && groupById(r.gid) ? r.gid : null;
        state.k = r.k ?? state.k;
        clampIntruderCount();
    }
    start();
}
