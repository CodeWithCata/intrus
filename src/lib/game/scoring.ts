/**
 * Per-group all-time statistics: recordRoundStats() after each round, closeSeries() when a
 * series ends.
 */
import { blankPlayerStats, currentGroup } from "#lib/stores/groups.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { uniqueId } from "#lib/utils/id.ts";
import { round } from "#lib/stores/ui.svelte.ts";

export function recordRoundStats(o: number, d: Record<number, number>) {
    const g = currentGroup();
    if (!g) {
        return;
    }
    state.players.forEach(p => {
        p.u = p.u || uniqueId();
    });
    g.pl = state.players.map(p => ({ ...p }));
    const s = g.st;
    s.r++;
    if (round.troll) {
        s.t = (s.t || 0) + 1;
        return;
    }
    /* a simultaneous vote is anonymous: votes[i] is not player i's vote, so "votes cast / hit" stay untouched */
    const all = round.votes.length == state.players.length && !round.anon;
    state.players.forEach((p, i) => {
        const q = s.p[p.u!] || (s.p[p.u!] = blankPlayerStats());
        q.r++;
        q.pt += d[i];
        if (round.intr.includes(i)) {
            q.i++;
            if (o == 2) {
                q.e++;
            }
            else {
                q.c++;
                if (o == 1) {
                    q.g++;
                }
            }
        }
        if (all) {
            q.vt++;
            if (round.intr.includes(round.votes[i])) {
                q.vr++;
            }
        }
    });
}

export function closeSeries() {
    const g = currentGroup();
    if (g && state.sr > 0) {
        const mx = Math.max(...Object.values(state.scores));
        if (mx > 0) {
            state.players.forEach((p, i) => {
                if ((state.scores[i] || 0) === mx) {
                    const q = g.st.p[p.u!];
                    if (q) {
                        q.w++;
                    }
                }
            });
        }
        g.st.s++;
    }
    state.sr = 0;
    state.scores = {};
    state.last = [];
}
