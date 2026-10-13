<!-- Pass screen: gate ("Sunt {name}") first, then the card step. -->
<script lang="ts">
  /**
   * Pass-the-phone screen. It has two steps: first a GATE that only names the next player (nothing secret is on screen, so
   * whoever is still holding the phone sees nothing), then, after that player taps "Sunt <nume>", the card: hold it to see the
   * word (or INTRUS), then pass the phone on. The card step keeps the markup and class names of the former HTML-string template.
   * With the "Ecran de predare" setting off (state.gt) the gate is skipped and the card step opens at once.
   * The gate is local state, so every go("pass", { i }) (and a resumed round) starts on the gate again.
   */
  import { flushSync } from "svelte";
  import TopBar from "#lib/components/layout/TopBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import Card from "#lib/components/game/Card.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { round } from "#lib/stores/ui.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { popEl } from "#lib/animations/motion.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import { go } from "#lib/stores/nav.svelte.ts";
  import { cardFor, partnersOf } from "#lib/game/twins.ts";

  let { i }: { i: number } = $props();

  const n = appState.players.length;
  // What this player's card shows: INTRUS or the word. The double agent of the "ag" twist sees the related word; with twin
  // words the intruders get the similar word and their card looks exactly like everybody's (see game/twins.ts).
  const view = $derived(cardFor(round, i));
  const mates = $derived(partnersOf(round, i).map((j) => ({ p: appState.players[j], name: playerName(j) })));

  let ready = $state(!appState.gt);
  let seen = $state(false);
  let next: HTMLButtonElement | undefined = $state();
  let heading: HTMLElement | undefined = $state();

  // The right player took the phone: show the card step. The gate button disappears, so focus moves to the new heading.
  function takeover() {
    ready = true;
    beep(520, 0.04);
    vibrate(10);
    flushSync();
    heading?.focus();
  }

  // First time the card is opened the "next" button wakes up (and stays enabled).
  function onreveal() {
    if (seen) {
      return;
    }
    seen = true;
    flushSync();
    if (next) {
      popEl(next);
    }
  }
</script>

<section class="screen"
  ><TopBar {i} {n} label="rdTopPlayer" />
  {#if !ready}
    <div class="gate"><Avatar player={appState.players[i]} size={132} /><h1 class="h1">{t("passGateHandOver", { name: playerName(i) })}</h1><p class="muted">{t("passGateWarn", { name: playerName(i) })}</p></div>
    <footer class="dock"><button class="btn go" id="gt" onclick={takeover}>{t("passGateGo", { name: playerName(i) })}</button></footer>
  {:else}
    <div class="who"><Avatar player={appState.players[i]} size={56} /><div><h1 class="h1" tabindex="-1" bind:this={heading}>{playerName(i)}</h1><p class="muted">{t("rdHold")}</p></div></div>
    <Card intruder={view.intruder} secret={view.secret} hint={round.hint} {mates} {onreveal} />
    <footer class="dock"
      ><button class="btn go" id="nx" disabled={!seen} onclick={() => (i + 1 >= n ? go("talk") : go("pass", { i: i + 1 }))} bind:this={next}>{i + 1 >= n ? t("rdStartTalk") : t("rdPassOn")}</button
      ><p class="note small muted" id="nt">{seen ? t("rdReady") : t("rdSeeFirst")}</p></footer
    >
  {/if}</section
>
