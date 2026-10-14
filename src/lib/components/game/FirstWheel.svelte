<!-- Opening wheel: one rotating disc that lands on round.first. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * The opening wheel: a disc of player avatars that spins and stops on `first` (the engine has already chosen who starts; the
   * wheel only shows it). ONE element rotates (transform only, via the Web Animations API), the avatars are drawn once, and
   * will-change is set on the disc only while it turns. Tick sound and one vibration per slice.
   * "Sari peste" jumps the disc to its final angle and then follows the SAME handoff as a spin that ran to the end (stop cue,
   * WHEEL_SETTLE_MS pause, then `ondone`): who starts is never announced while the wheel is still on screen. Both paths go
   * through `settle()` below.
   * Online, the server fixes `startAt` (this device's clock, ms): every phone waits for it and then turns the same wheel, so they
   * all stop on `first` together; a phone that gets there late joins the spin where it is. `players` is then the room's players.
   * The caller does not mount this in relaxed mode or with reduced motion (see views/talk.ts and utils/calm.ts `wheelAllowed`), where the plain
   * "Începe …" line is enough. It does run in lite mode ("Mod telefon slab").
   */
  import { onMount, untrack } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { planWheel, WHEEL_EASING, WHEEL_SETTLE_MS } from "#lib/game/wheel.ts";
  import { wheelTick, wheelStop } from "#lib/audio/drama-sounds.ts";
  import { vibrate } from "#lib/audio/haptics.ts";

  let { first, ondone, players = appState.players, startAt }: { first: number; ondone: () => void; players?: { a: number; l?: number; ph?: string }[]; startAt?: number } = $props();

  const n = untrack(() => players.length);
  const size = n > 8 ? 28 : n > 6 ? 34 : 40;
  /**
   * Slice colours: two tints alternate; with an odd count the last slice takes a third tint so it never touches a slice of its
   * own colour. Built once from numbers only (no player text). Slice i is centred at i * 360 / n, so the gradient starts half a slice early.
   */
  const discBg = `conic-gradient(from ${-180 / n}deg, ${Array.from({ length: n }, (_, i) => `var(--wc${i % 2 ? 2 : n % 2 && i === n - 1 && n > 1 ? 3 : 1}) ${(i * 360) / n}deg ${((i + 1) * 360) / n}deg`).join(", ")})`;
  let disk = $state<HTMLElement>();
  let ptr = $state<HTMLElement>();
  /** Each slice that passes the pointer flicks it aside and it springs back: one short transform animation on a tiny element. */
  const flick = () => ptr?.animate?.([{ transform: "rotate(0deg)" }, { transform: "rotate(-18deg)", offset: 0.3 }, { transform: "rotate(0deg)" }], { duration: 140, easing: "ease-out" });
  /** True from the moment the disc is on its final angle until the wheel is unmounted; hides "Sari peste" and makes `settle` run once. */
  let settled = $state(false);

  onMount(() => {
    const plan = planWheel(n, first);
    const ids: ReturnType<typeof setTimeout>[] = [];
    let anim: Animation | null = null;

    /** Puts the disc on its final angle, plays the stop cue and, after WHEEL_SETTLE_MS, hands over to the line below. Runs once. */
    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      ids.forEach(clearTimeout);
      ids.length = 0;
      if (disk) {
        disk.style.willChange = "";
        // keep the final angle visible while the line below takes over
        disk.style.transform = `rotate(${plan.angle % 360}deg)`;
      }
      anim?.cancel();
      wheelStop();
      vibrate([20, 40, 20]);
      ids.push(setTimeout(ondone, WHEEL_SETTLE_MS));
    };

    skip = settle;

    if (!disk || !disk.animate) {
      settle();
      return () => ids.forEach(clearTimeout);
    }
    const [x1, y1, x2, y2] = WHEEL_EASING;
    const begin = (elapsed: number) => {
      if (settled || !disk) {
        return;
      }
      disk.style.willChange = "transform";
      anim = disk.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${plan.angle}deg)` }], { duration: plan.ms, easing: `cubic-bezier(${x1},${y1},${x2},${y2})`, fill: "forwards" });
      if (elapsed > 0) {
        anim.currentTime = elapsed;
      }
      anim.onfinish = settle;
      plan.ticks.forEach((at, i) => {
        if (at > elapsed) {
          ids.push(setTimeout(() => {
            wheelTick(i / Math.max(1, plan.ticks.length - 1));
            vibrate(8);
            flick();
          }, at - elapsed));
        }
      });
    };
    const late = startAt === undefined ? 0 : Date.now() - startAt;
    if (late >= plan.ms) {
      settle();
    }
    else if (late < 0) {
      ids.push(setTimeout(() => begin(0), -late));
    }
    else {
      begin(late);
    }
    return () => {
      ids.forEach(clearTimeout);
      anim?.cancel();
    };
  });

  let skip: () => void = () => {};
</script>

<div class="wheelbox"
  ><div class="wheelwrap" role="img" aria-label={t("rdWheelAria")}
    ><i class="wptr" bind:this={ptr} aria-hidden="true"></i
    ><div class="wheel" bind:this={disk} style:background={discBg} style:--n={n} style:--sz="{size}px"
      >{#each players as p, i (i)}<span class="wslice" class:win={settled && i === first} style="--a:{(i * 360) / n}deg"><span class="wav"><Avatar player={p} {size} /></span></span>{/each}</div
    ><i class="whub" aria-hidden="true"></i></div
  ><button class="link wskip" disabled={settled} style:visibility={settled ? "hidden" : null} onclick={() => skip()}>{t("rdSkip")}</button></div
>
