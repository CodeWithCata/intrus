<!-- Simultaneous (anonymous) vote screen. -->
<script lang="ts">
  /**
   * Simultaneous vote: one tile per player, a 3-2-1 countdown, and everybody puts a finger on the tile of the player they suspect
   * at the same time. When the countdown ends, the fingers on each tile are the votes (anonymous, see game/simvote.ts).
   * Pointer Events with pointerId tracking, touch-action:none, hit-test by position. "Votăm pe rând" is always there as a way out.
   */
  import { onDestroy } from "svelte";
  import QuitBar from "#lib/components/layout/QuitBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { round } from "#lib/stores/ui.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { go } from "#lib/stores/nav.svelte.ts";
  import { countTouches, votesFromCounts, type Box, type Point } from "#lib/game/simvote.ts";
  import { toast } from "#lib/components/ui/toast.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";

  const n = appState.players.length;
  let phase = $state<"ready" | "count" | "done">("ready");
  let left = $state(3);
  let live = $state<number[]>(Array(n).fill(0));
  const tiles: HTMLElement[] = $state([]);
  // Plain Map on purpose: pointer positions are bookkeeping read by handlers only, never rendered.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const points = new Map<number, Point>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let next: ReturnType<typeof setTimeout> | undefined;

  const boxes = (): Box[] => tiles.map((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });

  const refresh = () => {
    live = countTouches(points.values(), boxes());
  };

  function down(e: PointerEvent) {
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    catch {
      // pointer capture is optional
    }
    refresh();
    vibrate(10);
  }

  function move(e: PointerEvent) {
    if (points.has(e.pointerId)) {
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      refresh();
    }
  }

  function up(e: PointerEvent) {
    if (points.delete(e.pointerId)) {
      refresh();
    }
  }

  function begin() {
    phase = "count";
    left = 3;
    beep(440, 0.08);
    timer = setInterval(() => {
      left--;
      if (left > 0) {
        beep(440, 0.08);
        vibrate(15);
        return;
      }
      clearInterval(timer);
      finish();
    }, 1000);
  }

  function finish() {
    const counts = countTouches(points.values(), boxes());
    const votes = votesFromCounts(counts);
    if (!votes.length) {
      toast(t("simNoVotes"));
      phase = "ready";
      return;
    }
    round.votes = votes;
    round.anon = true; // who voted for whom is unknown: the per-voter stats skip this round
    phase = "done";
    live = counts;
    beep(660, 0.1);
    vibrate([30, 40, 30]);
    next = setTimeout(() => go("tally"), 700);
  }

  onDestroy(() => {
    clearInterval(timer);
    clearTimeout(next);
  });
</script>

<section class="screen"
  ><QuitBar />
  <div><h1 class="h1">{t("rdSimTitle")}</h1><p class="muted">{phase === "ready" ? t("rdSimReady") : phase === "count" ? t("rdSimCount") : t("rdSimDone")}</p></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="vgrid simgrid" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onlostpointercapture={up}
    >{#each appState.players as p, j (j)}<button type="button" tabindex="-1" class="suspect sim" aria-pressed={live[j] > 0} bind:this={tiles[j]}><Avatar player={p} size={56} />{playerName(j)}<span class="simdots" aria-hidden="true">{#each Array(live[j]) as _, ki (ki)}<i></i>{/each}</span></button>{/each}</div>
  {#if phase === "count"}{#key left}<p class="simcount" role="timer" aria-live="assertive">{left}</p>{/key}{/if}
  <footer class="dock"
    ><button class="btn go" disabled={phase !== "ready"} onclick={begin}>{t("rdBegin")}</button
    ><button class="link" disabled={phase !== "ready"} onclick={() => go("vote", { i: 0, seq: true })}>{t("rdSeqVote")}</button></footer
  ></section
>
