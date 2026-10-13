<!-- The secret card on the pass screen: hold to see the word, release to hide; uses peek-guard. -->
<script lang="ts">
  /**
   * The secret card: hold it to flip it open, let go and it closes again.
   * Markup and class names are identical to the former HTML-string template (the CSS targets them).
   * The gestures are plain listeners (not onpointerdown=...) on purpose: pointerdown stays
   * `passive`, and pointerleave / pointercancel / blur are not delegated by Svelte anyway.
   */
  import { flushSync, onMount } from "svelte";
  import CardBack from "#lib/components/game/CardBack.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { RV } from "#lib/components/settings/settings.ts";
  import { prefersReducedMotion } from "#lib/utils/media.ts";
  import { CBG } from "#lib/components/game/art.ts";
  import { rvFx } from "#lib/audio/reveal-sounds.ts";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { guardPeek, motionPermission, requestMotion } from "#lib/components/game/peek-guard.ts";
  import { toast } from "#lib/components/ui/toast.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import type { Player } from "#lib/game/types.ts";

  /** `mates`: the other intruders, shown on the face of an intruder's card in the "Intruși care se cunosc" mode. */
  let { intruder, secret, hint = "", mates = [], onreveal }: { intruder: boolean; secret: string; hint?: string; mates?: { p: Player; name: string }[]; onreveal: () => void } = $props();

  let card: HTMLElement;
  let shade: HTMLElement;
  let shown = $state(false);

  const design = appState.cd;
  const revealStyle = appState.rv && RV[appState.rv] ? appState.rv : "flip";
  const artwork = $derived(design == "classic" ? CBG(intruder) : "");

  onMount(() => {
    const ac = new AbortController();
    const { signal } = ac;
    // 0 = closed, 1 = turning away from the back, 2 = face visible
    let phase = 0;
    let turnOut: Animation | null = null;
    // "Protecție la ochi indiscreți": while the card is open it also closes on tab switch, rotation, tilt and shake.
    // Off (or relaxed mode): the card only follows the finger, as before.
    let stopGuard: (() => void) | null = null;
    const protect = () => appState.pv && !appState.rx;

    const showFace = () => {
      shown = true;
      if (protect()) {
        stopGuard = guardPeek(shut);
      }
      flushSync(); // the face must exist before the "turn in" animation starts
      rvFx();
      onreveal();
    };

    const open = (e: Event) => {
      // Only the keyboard path needs it (Space would scroll the page); pointerdown is passive, where it is a no-op that warns.
      if (e.type === "keydown") {
        e.preventDefault();
      }
      if (phase) {
        return;
      }
      if (protect() && e.type === "pointerdown" && motionPermission() === "unknown") {
        // iOS asks for motion access only from a user gesture: this is one. Refused or missing sensors mean "hold only".
        void requestMotion().then((p) => p === "denied" && toast(t("pvDenied")));
      }
      phase = 1;
      const id = (e as PointerEvent).pointerId;
      try {
        if (id !== undefined) card.setPointerCapture(id);
      } catch {
        // pointer capture is optional
      }
      const R = RV[appState.rv] || RV.flip;
      if (!card.animate || !R.o || prefersReducedMotion()) {
        phase = 2;
        showFace();
        return;
      }
      turnOut = card.animate(R.o, { duration: R.od, easing: R.oe, fill: "forwards" });
      if (R.sh) {
        shade.animate([{ opacity: 0 }, { opacity: 0.95 }], { duration: R.od, easing: "ease-in", fill: "forwards" });
      }
      turnOut.onfinish = () => {
        if (phase !== 1) {
          return;
        }
        phase = 2;
        turnOut = null;
        card.getAnimations().forEach((x) => x.cancel());
        shade.getAnimations().forEach((x) => x.cancel());
        showFace();
        card.animate(R.i!, { duration: R.id, easing: R.ie });
        if (R.sh) {
          shade.animate(
            [
              { opacity: 0.95, backgroundPosition: "0% 0" },
              { opacity: 0.7, backgroundPosition: "55% 0", offset: 0.5 },
              { opacity: 0, backgroundPosition: "100% 0" }
            ],
            { duration: R.id, easing: "ease-out" }
          );
        }
      };
    };

    const shut = () => {
      stopGuard?.();
      stopGuard = null;
      phase = 0;
      if (turnOut) {
        turnOut.onfinish = null;
        turnOut = null;
      }
      card.getAnimations().forEach((x) => x.cancel());
      shade.getAnimations().forEach((x) => x.cancel());
      shown = false;
      flushSync();
    };

    card.addEventListener("pointerdown", open, { passive: true, signal });
    for (const type of ["pointerup", "pointerleave", "pointercancel", "blur", "keyup"]) {
      card.addEventListener(type, shut, { signal });
    }
    card.addEventListener(
      "keydown",
      (e) => {
        if (e.key === " " || e.key === "Enter") {
          open(e);
        }
      },
      { signal }
    );
    card.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });

    return () => {
      stopGuard?.();
      ac.abort();
    };
  });
</script>

<div class="cardwrap"
  ><div class="card" class:open={shown} class:bad={shown && intruder} class:civ={shown && !intruder} id="card" data-cd={design} data-rv={revealStyle} role="button" tabindex="0" aria-label={t("rdHoldAria")} bind:this={card}
    ><CardBack
    /><div class="face" id="face">{#if shown}{#if intruder}<span class="stamp">{t("stStamp")}</span>{#if hint}<p class="hintline">{hint}</p>{/if}{#if mates.length}<div class="mates"><p class="matesl">{t(mates.length > 1 ? "rdMateMany" : "rdMateOne")}</p>{#each mates as m, ki (ki)}<span class="mate"><Avatar player={m.p} size={28} />{m.name}</span>{/each}</div>{/if}{:else}<p class="secret">{secret}</p>{/if}{/if}</div
    ><i class="shade" id="shade" bind:this={shade}></i
    ><!-- {@html} below: constant card-back artwork from CBG() in data/card-designs.ts, never user text --><svg class="cbg" id="cbg" viewBox="0 0 288 384" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{@html artwork}</svg></div
  ></div
>
