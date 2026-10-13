<!-- Online standings. -->
<script lang="ts">
  /** Online: the scoreboard, the local look: trophy, crown, avatars at 48px, the count-up and the confetti. +N is every phone's own sum of the round. */
  import { onMount } from "svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { TROPHY } from "#lib/components/game/art.ts";
  import { online, isHost, send, startScores } from "#lib/online/client.svelte.ts";
  import { countUp } from "#lib/animations/count-up.ts";
  import { confetti } from "#lib/components/game/confetti.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const players = $derived(online.state?.players ?? []);
  const ranking = $derived([...players].sort((a, b) => b.score - a.score));
  const gain = (id: string, score: number): number => online.delta?.[id] ?? Math.max(0, score - (startScores.scores[id] ?? score));

  onMount(() => {
    SFX.win();
    countUp();
    const id = setTimeout(confetti, 450);
    return () => clearTimeout(id);
  });
</script>

<!-- {@html} below: constant TROPHY artwork from game/art.ts, never user text -->
<header>{@html TROPHY}<h1 class="h1">{t("rdStandings")}</h1></header>
<ul class="full">{#each ranking as p, k (p.id)}<li class="score{k === 0 ? " top" : ""}"><span class="rank">{#if k === 0}<Icon name="crown" />{:else}{k + 1}{/if}</span><Avatar player={{ a: 0, l: p.l }} size={48} /><span class="name">{p.name}{#if gain(p.id, p.score)}<span class="muted"> +{gain(p.id, p.score)}</span>{/if}</span><span class="tot">{p.score}</span></li>{/each}</ul>
<div class="grow"></div>
<footer class="dock">
  {#if isHost()}<button class="btn go" onclick={() => send({ type: "next-round" })}>{t("nextRound")}</button>
  {:else}<p class="note small muted">{t("olWaitingNext")}</p>{/if}
</footer>
