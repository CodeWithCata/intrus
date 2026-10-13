<!-- Online round step: discussion with the shared wheel, timer and question card. -->
<script lang="ts">
  /**
   * Online: the discussion. The wheel, the ring, the clock and the dimming are the local components; what they show comes from the
   * server: who starts, when the shared wheel turns (every phone spins it together and stops on the same player) and the timer.
   */
  import { untrack } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import FirstWheel from "#lib/components/game/FirstWheel.svelte";
  import TimerRing from "#lib/components/game/TimerRing.svelte";
  import TalkControls from "#lib/components/game/TalkControls.svelte";
  import TalkDim from "#lib/components/game/TalkDim.svelte";
  import TwistCard from "#lib/components/game/TwistCard.svelte";
  import OnlineQuestion from "#lib/components/online/OnlineQuestion.svelte";
  import { online, isHost, send, talkLocal, wheelPending } from "#lib/online/client.svelte.ts";
  import { wheelAllowed } from "#lib/utils/calm.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const st = $derived(online.state);
  /** The wheel (and the starter) are about the players dealt into this round, in the same order on every phone. */
  const players = $derived(st?.dealt ? (st?.players ?? []).filter((p) => st?.dealt?.includes(p.id)) : (st?.players ?? []));
  const talk = $derived(st?.talk ?? null);
  const first = $derived(talk ? players.findIndex((p) => p.id === talk.starterId) : -1);
  const starter = $derived(first >= 0 ? players[first] : null);
  const timer = $derived(st?.timer ?? null);
  const wheelPlayers = $derived(players.map((p) => ({ a: 0, l: p.l })));

  /** The wheel is shown unless it is already over (a refresh later in the round), or it is off (relaxed mode, reduced motion). It does run in lite mode. */
  let spinning = $state(untrack(() => wheelPending() && players.length >= 2 && first >= 0 && wheelAllowed()));
  function landed() {
    spinning = false;
  }
</script>

{#if timer}<TalkDim />{/if}
<div><h1 class="h1">{t("rdDiscussion")}</h1><p class="muted">{st?.settings?.qm ? t("rdTalkQ") : t("rdTalkW")}</p></div>
{#if spinning}<FirstWheel {first} players={wheelPlayers} startAt={talkLocal.startAt} ondone={landed} />{/if}
{#if starter}<p class="starter" style:visibility={spinning ? "hidden" : null}><Avatar player={{ a: 0, l: starter.l }} size={32} />{t("rdStarts", { name: starter.name })}</p>{/if}
<TwistCard tw={st?.twist ?? null} />{#if st?.question}<OnlineQuestion />{/if}
<div class="grow"></div>
{#if timer}<TimerRing />{/if}
<div class="grow"></div>
{#if timer && isHost()}<TalkControls onpause={() => send({ type: "timer", action: timer.status === "paused" ? "resume" : "pause" })} onadd={() => send({ type: "timer", action: "add" })} />{/if}
<footer class="dock">
  {#if isHost()}
    <button class="btn go" onclick={() => send({ type: "vote-open" })}>{t("rdToVote")}</button><button class="link" onclick={() => send({ type: "reveal" })}>{t("rdSkipVote")}</button>
  {:else}
    <p class="note small muted">{t("olHostEnds")}</p>
  {/if}
</footer>
