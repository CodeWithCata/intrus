<!-- Talk timer ring with the polite live-region announcements. -->
<script lang="ts">
  /**
   * Ring + clock of the discussion timer, bound to the reactive `talkClock` (stores/talk.svelte.ts).
   * The only imperative bit is restarting the "ping" CSS animation each second. When the last seconds begin
   * (`talkClock.alerts` changes) a red copy of the ring flashes once: the `{#key}` re-creates it, which restarts its animation.
   */
  import { RING_C } from "#lib/components/game/timer.ts";
  import { formatClock } from "#lib/utils/format.ts";
  import { talkClock } from "#lib/stores/talk.svelte.ts";

  let box = $state<HTMLElement>();
  let lastPing = 0;

  $effect(() => {
    const n = talkClock.pings;
    if (!box || n === lastPing) {
      return;
    }
    lastPing = n;
    // Swapping between two classes with the same animation under different names restarts it without forcing a reflow each second.
    const odd = n % 2 === 1;
    box.classList.remove(odd ? "ping2" : "ping");
    box.classList.add(odd ? "ping" : "ping2");
  });
</script>

<div class="ringbox" class:pz={talkClock.paused} bind:this={box}
  ><svg class="r" viewBox="0 0 208 208" aria-hidden="true"
    ><circle cx="104" cy="104" r="88" fill="none" style="stroke:var(--line)" stroke-width="12" /><circle id="rg" cx="104" cy="104" r="88" fill="none" style="stroke:var(--ink)" stroke-width="12" stroke-linecap="round" stroke-dasharray={RING_C} stroke-dashoffset={RING_C * (1 - talkClock.frac)} />{#key talkClock.alerts}{#if talkClock.alerts}<circle class="rpulse" cx="104" cy="104" r="88" fill="none" style="stroke:var(--red)" stroke-width="12" />{/if}{/key}</svg
  ><p class="timer" class:low={talkClock.t <= 10} id="tm" role="timer" aria-live="off">{formatClock(Math.max(talkClock.t, 0))}</p
  ><p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{talkClock.say}</p></div
>
