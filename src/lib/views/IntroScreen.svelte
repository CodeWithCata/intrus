<!-- Intro slides screen. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * First-run intro: three swipeable slides with progress dots.
   * Markup and class names are identical to the former HTML-string template (the CSS targets them).
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import SlideWords from "#lib/components/intro/slides/SlideWords.svelte";
  import SlideBubbles from "#lib/components/intro/slides/SlideBubbles.svelte";
  import SlidePick from "#lib/components/intro/slides/SlidePick.svelte";
  import { IS, IS_KEYS } from "#lib/components/intro/intro-data.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { saveStateNow } from "#lib/storage/persist.svelte.ts";
  import { prefersReducedMotion } from "#lib/utils/media.ts";
  import { go } from "#lib/stores/nav.svelte.ts";

  // One picture per entry of IS, same order.
  const visuals = [SlideWords, SlideBubbles, SlidePick];

  // Index of the slide the slider is currently on (drives the dots and the button label).
  let cur = $state(0);
  let slides: HTMLElement;

  /** "Sari peste" / last slide: remember that the intro was seen and go to the setup screen. */
  function skip() {
    appState.seen = true;
    saveStateNow();
    beep(660, .08);
    vibrate(15);
    go("setup");
  }

  /** "Mai departe": scroll to the next slide, or leave after the last one. */
  function next() {
    const k = Math.round(slides.scrollLeft / slides.clientWidth);
    if (k >= IS.length - 1) {
      skip();
      return;
    }
    slides.scrollTo({ left: (k + 1) * slides.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    beep(560, .05);
    vibrate(10);
  }

  function onscroll(e: Event) {
    const sl = e.currentTarget as HTMLElement;
    const k = Math.round(sl.scrollLeft / sl.clientWidth);
    if (k === cur) {
      return;
    }
    cur = k;
    beep(480 + k * 80, .04);
    vibrate(8);
  }
</script>

<section class="intro"
  ><header class="itop"><b class="iw">INTRUS</b><button class="hbtn txt" onclick={skip}>{t("rdSkip")}</button></header>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="islides" id="isl" tabindex="0" aria-label={t("isAria")} bind:this={slides} {onscroll}
    >{#each IS_KEYS as [kt, kd], k (k)}{@const Visual = visuals[k]}<article class="isl"
        ><Visual /><div class="it"><h2>{t(kt)}</h2><p>{t(kd)}</p></div></article
      >{/each}</div
  >
  <footer class="dock"
    ><div class="idots" aria-hidden="true">{#each IS as _, j (j)}<i class:on={j === cur}></i>{/each}</div
    ><button class="btn go" id="inx" onclick={next}><span>{cur === IS.length - 1 ? t("isLets") : t("isNext")}</span
      ><Icon name="chev" /></button></footer
  >
</section>
