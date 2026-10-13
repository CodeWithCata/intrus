<!-- Opacity-only cover over the already-rendered reveal result (vote drama). -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * The staged build-up in front of the intruder reveal. The real result is already in the page underneath (so nothing here can
   * change it and a screen reader or a test sees it at once); this is a cover that plays `plan` (game/drama.ts): a drumroll,
   * sometimes a fake pick of an INNOCENT player that flips ("Alarmă falsă!"), then it fades away (opacity only). Tap to skip.
   * Never longer than MAX_DRAMA_MS. The fake is only drawn here: scoring and stats never see it.
   */
  import { onMount } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { runPlan, type DramaStep, type RevealPlan } from "#lib/game/drama.ts";
  import { dramaRoll, dramaFake, dramaFlip } from "#lib/audio/drama-sounds.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { screenShake } from "#lib/animations/motion.ts";

  /** `players` replaces the local players (online: the room's players, with their names). */
  let { plan, ondone, players }: { plan: RevealPlan; ondone?: () => void; players?: { a: number; l?: number; name: string }[] } = $props();
  const fakeP = $derived(plan.fake === null ? null : players ? players[plan.fake] : { ...appState.players[plan.fake], name: playerName(plan.fake) });

  let phase = $state<"roll" | "fake" | "flip" | "gone">("roll");
  let leaving = $state(false);
  let stop: (finish?: boolean) => void = () => {};

  function on(s: DramaStep) {
    if (s.kind === "roll") {
      dramaRoll(plan.steps[1]?.at ?? 900);
      vibrate([15, 40, 15, 40, 15, 40, 15]);
    }
    else if (s.kind === "fake") {
      phase = "fake";
      dramaFake();
      vibrate(40);
    }
    else if (s.kind === "flip") {
      phase = "flip";
      dramaFlip();
      vibrate([30, 40, 30]);
    }
    else {
      SFX.intrus();
      vibrate([80, 60, 80]);
      screenShake();
      leaving = true;
      setTimeout(() => {
        phase = "gone";
        ondone?.();
      }, 260);
    }
  }

  onMount(() => {
    stop = runPlan(plan.steps, on);
    return () => stop();
  });
</script>

{#if phase !== "gone"}
  <button class="dlay" class:out={leaving} onclick={() => stop(true)} aria-label={t("rdSkip")}>
    {#if phase === "roll"}
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="dtxt">{t("rdCounting")}</span>
    {:else if plan.fake !== null}
      <span class="dfake" class:flip={phase === "flip"}>{#if fakeP}<Avatar player={fakeP} size={72} /><span class="dname">{fakeP.name}</span>{/if}</span>
      <span class="dtxt">{phase === "fake" ? t("rdWouldBe") : t("rdFalse")}</span>
    {/if}
  </button>
{/if}
<p class="sr-only" role="status" aria-live="polite">{phase === "roll" ? t("rdCountingSr") : ""}</p>
