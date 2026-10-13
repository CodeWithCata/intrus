<!-- Scoreboard after a round. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Scoreboard shown after every round: ranking with the points just earned (`gain`), the
   * next-design hint, the "save group" row and the next-round / rematch / new-game buttons.
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import PlayerTitle from "#lib/components/players/PlayerTitle.svelte";
  import NextDesignNote from "#lib/components/game/NextDesignNote.svelte";
  import SaveGroupBar from "#lib/components/groups/SaveGroupBar.svelte";
  import { TROPHY } from "#lib/components/game/art.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { start } from "#lib/game/engine.ts";
  import { newGame, rematch } from "#lib/game/session.ts";

  // `order` = player indexes from first to last place, `gain` = points earned this round per player.
  let { order, gain }: { order: number[]; gain: Record<number, number> } = $props();
</script>

<section class="screen center"
  ><!-- {@html} below: constant TROPHY artwork from game/art.ts, never user text --><header>{@html TROPHY}<h1 class="h1">{t("rdStandings")}</h1></header>
  <ul class="full">{#each order as i, k (k)}<li class="score{k == 0 ? ' top' : ''}"><span class="rank">{#if k == 0}<Icon name="crown" />{:else}{k + 1}{/if}</span><Avatar player={state.players[i]} size={48} /><span class="name">{playerName(i)}{#if gain[i]}<span class="muted"> +{gain[i]}</span>{/if}<PlayerTitle {i} /></span><span class="tot">{state.scores[i]}</span></li>{/each}</ul>
  <div class="grow"></div>
  <NextDesignNote /><SaveGroupBar /><footer class="dock"><button class="btn go" onclick={start}>{t("rdNextRound")}</button><div class="lk"><button class="link" onclick={rematch}>{t("suRematch")}</button><button class="link" onclick={newGame}>{t("rdNewGame")}</button></div></footer></section
>
