<script lang="ts">
  import "#lib/styles/fonts.css";
  import "#lib/styles/tokens.css";
  import "#lib/styles/base.css";
  import "#lib/styles/features.css";
  import "#lib/styles/shell.css";
  import "#lib/styles/motion.css";
  import "#lib/styles/sheets.css";
  import "#lib/styles/themes.css";
  import "#lib/styles/card-designs.css";
  import "#lib/styles/performance.css";
  import Background from "#lib/components/layout/Background.svelte";
  import App from "#lib/App.svelte";
  import { boot, debugWanted } from "#lib/boot.ts";
  import { onMount, tick } from "svelte";
  import { hideSplash } from "#lib/utils/splash.ts";

  let { children } = $props();
  let bgonly = $state(false);
  // The "show only background" eye button is a developer tool: it only exists in debug mode (?debug=1, see boot.ts).
  let debug = $state(false);

  // The heavy part (the background art and the whole app) mounts only after the splash animation has finished: mounting it while the
  // letters move blocks the main thread and the animation stutters. The splash is static by then, so the work is not seen.
  let ready = $state(false);
  const BUILD_MS = 1300; // how long the letters take (keep in step with the splash CSS in app.html)

  onMount(() => {
    const started = (window as Window & { __splashGo?: number }).__splashGo ?? 0;
    const calm = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const wait = calm ? 0 : Math.max(0, started + BUILD_MS - performance.now());
    const timer = setTimeout(async () => {
      ready = true;
      await tick();
      boot();
      debug = debugWanted();
      hideSplash();
    }, wait);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    document.body.classList.toggle("bgonly", bgonly);
  });
</script>

{#if ready}<Background />{/if}
<div id="app">{#if ready}<App />{/if}</div>
<div id="sr"></div>
{#if debug}<button class="bgtest" id="bgtest" aria-pressed={bgonly} aria-label="Test: arată doar fundalul" onclick={() => (bgonly = !bgonly)}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M4 4l16 16"/></svg>
</button>{/if}
{@render children()}
