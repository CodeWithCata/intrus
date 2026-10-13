/**
 * Saved groups: the handlers of the groups / group-stats / group-name sheets, and the standings
 * and awards the stats sheet shows.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { lastRoundResult, autoGroupName, blankPlayerStats, clampIntruderCount, groupById } from "#lib/stores/groups.svelte.ts";
import { uniqueId, displayName } from "#lib/utils/id.ts";
import { closeSeries, recordRoundStats } from "#lib/game/scoring.ts";
import { applyGroupList } from "#lib/stores/wordlists.svelte.ts";
import { start } from "#lib/game/engine.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { ask } from "#lib/stores/ask.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import type { Group, Player, PlayerStats } from "#lib/game/types.ts";

/** Opens the "save group" name sheet. `fromEnd`: opened from the scoreboard, so saving also records the round that just ended. */
export function openGroupNameSheet(fromEnd = false) {
    state.ge = null;
    state.gn = "";
    state.gfrom = fromEnd;
    state.sheet = "gname";
    beep(560, .05);
    vibrate(10);
}

export function openGroupStats(id: string) {
    state.gv = id;
    state.sheet = "gstats";
    beep(560, .05);
    vibrate(10);
}

/** "Redenumește" on the stats sheet: opens the name sheet for an existing group. */
export function renameGroup(id: string) {
    const g = groupById(id);
    if (!g) {
        return;
    }
    state.ge = id;
    state.gn = g.nm;
    state.sheet = "gname";
    beep(560, .05);
}

/** "Salvează" on the name sheet: renames the group being edited, or saves the current players as a new one. */
export function saveGroup() {
    const n = (state.gn || "").trim() || autoGroupName();
    if (state.ge) {
        const g = groupById(state.ge);
        if (g) {
            g.nm = n;
        }
        state.gv = state.ge;
    }
    else {
        state.players.forEach(p => {
            p.u = p.u || uniqueId();
        });
        const g = { id: uniqueId(), nm: n, pl: state.players.map(p => ({ ...p })), st: { r: 0, s: 0, t: 0, p: {} } };
        state.groups.push(g);
        state.gid = g.id;
        state.gv = g.id;
        if (state.gfrom && lastRoundResult && state.sr > 0) {
            recordRoundStats(lastRoundResult.o, lastRoundResult.d);
        }
    }
    state.ge = null;
    state.gn = "";
    state.gfrom = false;
    state.sheet = "gstats";
    beep(660, .06);
    vibrate(15);
}

function selectGroup(g: Group) {
    closeSeries();
    state.players = g.pl.map(p => ({ ...p }));
    state.gid = g.id;
    clampIntruderCount();
    applyGroupList(g);
    state.sheet = null;
}

/** "Joacă" / "Revanșă": loads the group and starts a round. */
export function playGroup(id: string) {
    const g = groupById(id);
    if (!g) {
        return;
    }
    selectGroup(g);
    start();
}

/** "Încarcă în setări": loads the group without starting. */
export function loadGroup(id: string) {
    const g = groupById(id);
    if (!g) {
        return;
    }
    selectGroup(g);
    toast(t("grLoaded", { name: g.nm }));
    beep(620, .06);
    vibrate(12);
}

export function deleteGroup(id: string) {
    const g = groupById(id);
    if (!g) {
        return;
    }
    ask(t("grDeleteAsk"), t("grDeleteDesc"), t("grDeleteYes"), () => {
        state.groups = state.groups.filter(x => x.id !== id);
        if (state.gid === id) {
            state.gid = null;
        }
        state.sheet = state.groups.length ? "groups" : null;
    });
}

export interface Standing {
    p: Player;
    i: number;
    q: PlayerStats;
}

/** The players of a group, best first (points, then series won). */
export const standings = (g: Group): Standing[] => g.pl.map((p, i) => ({ p, i, q: g.st.p[p.u as string] || blankPlayerStats() })).sort((a, b) => b.q.pt - a.q.pt || b.q.w - a.q.w);

/** The prizes with a winner: icon, title, and the line under it. */
export function awards(g: Group): { icon: string; title: string; text: string }[] {
    const R = standings(g), ori = (n: number) => n == 1 ? t("grOnce") : t("grTimes", { n });
    const top = (f: (q: PlayerStats) => number) => {
        let b: { x: Standing; v: number } | null = null;
        R.forEach(x => {
            const v = f(x.q);
            if (v > 0 && (!b || v > b.v)) {
                b = { x, v };
            }
        });
        return b as { x: Standing; v: number } | null;
    };
    const who = (b: { x: Standing }) => displayName(b.x.p, b.x.i);
    const out: { icon: string; title: string; text: string }[] = [];
    const e = top(q => q.e), d = top(q => q.vt >= 3 ? Math.round(100 * q.vr / q.vt) : 0), c = top(q => q.c);
    if (e) {
        out.push({ icon: "mask", title: t("grBestIntruder"), text: t("grBestIntruderText", { who: who(e), times: ori(e.v) }) });
    }
    if (d) {
        out.push({ icon: "search", title: t("grDetective"), text: t("grDetectiveText", { who: who(d), pct: d.v }) });
    }
    if (c) {
        out.push({ icon: "ghost", title: t("grMostCaught"), text: t("grMostCaughtText", { who: who(c), times: ori(c.v) }) });
    }
    return out;
}
