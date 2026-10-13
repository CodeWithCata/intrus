<!-- Reveal screen (word and intruders) with vote drama. -->
<script lang="ts">
  /**
   * Reveal screen: who the intruder(s) were, the twist note, the verdict of the vote and the
   * outcome picker (end() then scores the round). `rec` is the recommended outcome (-1 = none).
   */
  import QuitBar from "#lib/components/layout/QuitBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import PlayerTitle from "#lib/components/players/PlayerTitle.svelte";
  import TwistNote from "#lib/components/game/TwistNote.svelte";
  import { CONE } from "#lib/components/game/art.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import RevealDrama from "#lib/components/game/RevealDrama.svelte";
  import { end } from "#lib/game/engine.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import type { RevealPlan } from "#lib/game/drama.ts";

  let { round, caught, rec, mult, plan = null }: { round: any; caught: boolean; rec: number; mult: number; plan?: RevealPlan | null } = $props();

  const outcomes: [string, string][] = $derived([
    [t("rdOutCaught"), t("rdPtsOthers", { n: mult })],
    [t("rdOutGuess"), t("rdPtsIntr", { n: mult })],
    [t("rdOutEscaped"), t("rdPtsIntr", { n: 2 * mult })]
  ]);
</script>

<section class="screen center"
  ><QuitBar />
  <div class="dwrap"><p class="muted" role="heading" aria-level="1">{t(round.intr.length > 1 ? "rdIntrWere" : "rdIntrWas")}</p>
    <!-- {@html} below: constant CONE artwork from game/art.ts, never user text -->
    <div class="stage">{@html CONE}{#each round.intr as i, ki (ki)}<div><Avatar player={state.players[i]} size={96} /><p class="h2">{playerName(i)}</p><PlayerTitle {i} /></div>{/each}</div>
    <span class="stamp red">{t("stStamp")}</span>{#if plan}<RevealDrama {plan} />{/if}</div>
  <div><p class="muted">{t("rdWordWas")}</p><p class="wordtag">{round.word}</p>{#if round.tn && round.twin}<p class="muted">{t(round.intr.length > 1 ? "rdIntrHadMany" : "rdIntrHadOne", { w: round.twin })}</p>{/if}</div>
  <TwistNote {round} />{#if round.top}<p class="verdict">{caught ? t("rdCaught") : t("rdWrong")}</p>{/if}
  <div class="grow"></div>
  <footer class="dock"><p class="h2">{t("rdHow")}</p>
    {#if round.tn}<p class="muted small">{t("twNoGuess")}</p>{/if}
    {#each outcomes as [label, points], k (k)}{#if !(round.tn && k === 1)}<button class="outcome{k === rec ? ' rec' : ''}" onclick={() => end(k)}><span>{label}</span><span class="pts">{points}</span></button>{/if}{/each}</footer></section
>
