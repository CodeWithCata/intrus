/**
 * Voting logic: every player picks who they think the intruder is (VoteScreen.svelte), or - with "Mod de vot: Simultan" and a
 * device that can track the fingers - everybody at once (SimVoteScreen.svelte, views/svote.ts). Otherwise it falls back to the
 * one-by-one vote with a toast that says why.
 */
import { round } from "#lib/stores/ui.svelte.ts";
import { stopTalkTimer } from "#lib/stores/talk.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { go, onEnter } from "#lib/stores/nav.svelte.ts";
import { inRoom } from "#lib/online/client.svelte.ts";
import { SIM_CAP, simVoteAllowed } from "#lib/game/simvote.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";

onEnter("vote", props => {
    stopTalkTimer();
    const n = state.players.length;
    if (Number(props?.i) >= n) {
        go("tally");
        return false;
    }
    if (Number(props?.i) === 0) {
        if (state.vm === "sim" && !props?.seq) {
            const ok = simVoteAllowed(n, navigator.maxTouchPoints, inRoom());
            if (ok.ok) {
                go("svote");
                return false;
            }
            toast(ok.reason === "online" ? t("simFallbackOnline") : ok.reason === "cap" ? t("simFallbackCap", { n: SIM_CAP }) : t("simFallbackTouch"));
        }
        round.anon = false;
    }
    round.pk = null;
});
