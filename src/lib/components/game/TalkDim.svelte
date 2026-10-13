<script lang="ts">
  /**
   * "Lumina se stinge": in the last 10 seconds of the talk timer the screen dims through ONE fixed flat-colour overlay whose
   * opacity rises (opacity is the only thing that changes). pointer-events:none, so it never blocks a tap or the timer controls.
   * Not rendered in lite mode, relaxed mode or with reduced motion; the heartbeat vibration lives in stores/talk.svelte.ts.
   */
  import { talkClock } from "#lib/stores/talk.svelte.ts";
  import { dimLevel } from "#lib/game/tension.ts";
  import { isCalm } from "#lib/utils/calm.ts";

  const calm = isCalm();
  const level = $derived(dimLevel(talkClock.t));
</script>

{#if !calm}<div class="talkdim" aria-hidden="true" style:opacity={level}></div>{/if}
