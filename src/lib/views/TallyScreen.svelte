<!-- Vote tally screen (rows revealed one by one). -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Vote tally: how many votes each player got; the most voted ones are highlighted. With `drama` the rows appear one by one
   * (fewest votes first): opacity only, a thump and a vibration per row; tap the button at any time to go on.
   */
  import { onMount, untrack } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { go } from "#lib/stores/nav.svelte.ts";
  import { dramaHit } from "#lib/audio/drama-sounds.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { vibrate } from "#lib/audio/haptics.ts";

  let { counts, top, drama = null }: { counts: Record<number, number>; top: number[]; drama?: { order: number[]; step: number } | null } = $props();

  /** How many rows are in so far (all of them without the drama). */
  let shown = $state(untrack(() => (drama ? 0 : appState.players.length)));
  const rank = (j: number) => (drama ? drama.order.indexOf(j) : 0);

  onMount(() => {
    if (!drama) {
      return;
    }
    const ids: ReturnType<typeof setTimeout>[] = [];
    const total = drama.order.length;
    for (let i = 0; i < total; i++) {
      // the last row (the most voted) waits a little longer
      ids.push(setTimeout(() => {
        shown = i + 1;
        if (i === total - 1) {
          SFX.votes();
          vibrate(60);
        }
        else {
          dramaHit(i);
          vibrate(8 + i);
        }
      }, 300 + i * drama.step + (i === total - 1 ? 250 : 0)));
    }
    return () => ids.forEach(clearTimeout);
  });
</script>

<section class="screen"
  ><header><h1 class="h1">{t("rdVotes")}</h1><p class="muted">{t("rdMostVoted")}</p></header>
  <ul>{#each appState.players as p, j (j)}<li class="score{top.includes(j) ? ' top' : ''}{drama && rank(j) >= shown ? ' wait' : ''}"><Avatar player={p} size={48} /><span class="name">{playerName(j)}</span><span class="tot">{counts[j] || 0}</span></li>{/each}</ul>
  <footer class="dock"><button class="btn go" onclick={() => go("reveal")}>{t("rdRevealIntr")}</button></footer></section
>
