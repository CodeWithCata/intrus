<!-- Pass-around vote screen. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Voting screen: player `i` secretly picks who they think the intruder is.
   * `picked` drives aria-pressed on the .suspect buttons and enables the confirm button.
   * Markup and class names are identical to the former template.
   */
  import { flushSync } from "svelte";
  import TopBar from "#lib/components/layout/TopBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { round } from "#lib/stores/ui.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { popEl, sparkBurst } from "#lib/animations/motion.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { go } from "#lib/stores/nav.svelte.ts";

  let { i }: { i: number } = $props();

  let picked = $state<number | null>(null);
  let ok: HTMLButtonElement;

  function pick(j: number, e: MouseEvent) {
    const first = picked === null;
    picked = j;
    round.pk = j;
    sparkBurst(e.currentTarget);
    if (first) {
      // The confirm button wakes up the first time somebody is picked.
      flushSync();
      popEl(ok);
    }
    beep(660, .06);
    vibrate(15);
  }

  function confirm() {
    round.votes.push(round.pk!);
    go("vote", { i: i + 1 });
  }
</script>

<section class="screen"
  ><TopBar {i} n={appState.players.length} label="rdTopVote" />
  <div class="who"><Avatar player={appState.players[i]} size={56} /><div><h1 class="h1">{playerName(i)}</h1><p class="muted">{t("rdVoteWho")}</p></div></div>
  <div class="vgrid">{#each appState.players as p, j (j)}{#if j !== i}<button class="suspect" onclick={(e) => pick(j, e)} aria-pressed={picked === j}><span class="lens"><Icon name="search" /></span><Avatar player={p} size={56} />{playerName(j)}</button>{/if}{/each}</div>
  <footer class="dock"><button class="btn go" id="ok" disabled={picked === null} onclick={confirm} bind:this={ok}>{t("rdConfirm")}</button></footer></section
>
