<script lang="ts">
  /** Online: how many votes each player got, the most voted highlighted (the local tally look, with the count-up). Then the host reveals. */
  import { onMount } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import { countUp } from "#lib/animations/count-up.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const players = $derived(online.state?.players ?? []);
  const vote = $derived(online.state?.vote ?? null);
  const tally = $derived(vote && vote.revealed ? vote.tally : {});
  const max = $derived(Math.max(0, ...Object.values(tally)));

  onMount(() => {
    SFX.votes();
    vibrate(60);
    countUp();
  });
</script>

<header><h1 class="h1">{t("rdVotes")}</h1><p class="muted">{t("rdMostVoted")}</p></header>
<ul>{#each players as p (p.id)}<li class="score{max > 0 && (tally[p.id] || 0) === max ? " top" : ""}"><Avatar player={{ a: 0, l: p.l }} size={48} /><span class="name">{p.name}</span><span class="tot">{tally[p.id] || 0}</span></li>{/each}</ul>
<div class="grow"></div>
<footer class="dock">
  {#if isHost()}<button class="btn go" onclick={() => send({ type: "reveal" })}>{t("rdRevealIntr")}</button>
  {:else}<p class="note small muted">{t("olWaitingReveal")}</p>{/if}
</footer>
