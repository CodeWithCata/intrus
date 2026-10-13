<!-- Online round step: vote. -->
<script lang="ts">
  /**
   * Online: the secret vote, with the local look: lens icon, spark burst, large avatars. A pick is sent at once (and can be changed
   * until the votes are shown); the row below shows who has voted, never for whom.
   */
  import Avatar from "#lib/components/players/Avatar.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import StatusRow from "#lib/components/online/StatusRow.svelte";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import { sparkBurst } from "#lib/animations/motion.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const st = $derived(online.state);
  const players = $derived(st?.players ?? []);
  const vote = $derived(st?.vote ?? null);
  const voted = $derived(vote?.voted ?? []);
  const me = $derived(players.find((p) => p.id === online.playerId));
  /** Only players who were dealt in can be accused or can vote (the server refuses anyone else). */
  const inRound = $derived(st?.dealt ? players.filter((p) => st.dealt?.includes(p.id)) : players);
  const others = $derived(inRound.filter((p) => p.id !== online.playerId));
  const here = $derived(inRound.filter((p) => p.connected));
  let picked = $state<string | null>(null);

  function pick(id: string, e: MouseEvent) {
    if (!send({ type: "vote", suspectId: id })) return; // connection down: the pick is NOT recorded, so do not show it as made
    picked = id;
    sparkBurst(e.currentTarget as HTMLElement);
    beep(660, 0.06);
    vibrate(15);
  }
</script>

{#if online.role}
  <div class="who">{#if me}<Avatar player={{ a: 0, l: me.l }} size={56} />{/if}<div><h1 class="h1">{me?.name ?? ""}</h1><p class="muted">{t("rdVoteWho")}</p></div></div>
  <div class="vgrid">{#each others as p (p.id)}<button class="suspect" onclick={(e) => pick(p.id, e)} aria-pressed={picked === p.id}><span class="lens"><Icon name="search" /></span><Avatar player={{ a: 0, l: p.l }} size={56} />{p.name}</button>{/each}</div>
{:else}
  <div class="who"><div><h1 class="h1">{t("voteTitle")}</h1><p class="muted">{t("olSpectator")}</p></div></div>
{/if}
<div class="grow"></div>
<footer class="dock">
  <StatusRow players={inRound} done={voted} />
  <p class="note small muted" role="status">{t("voteWait", { n: voted.length, total: here.length })}</p>
  {#if isHost()}<button class="btn go" onclick={() => send({ type: "vote-reveal" })}>{t("voteShow")}</button>{/if}
</footer>
