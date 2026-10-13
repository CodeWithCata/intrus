<!-- Online troll round result (everybody is an intruder, or twin words). -->
<script lang="ts">
  /**
   * Online: the reveal of the "everybody was an intruder" surprise round (no points are given). The same stage as the local
   * TrollRevealScreen. With twin words everybody simply held the same word. The host moves on; nobody else needs to do anything.
   */
  import { onMount } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { CONE } from "#lib/components/game/art.ts";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import { screenShake } from "#lib/animations/motion.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const players = $derived(online.state?.players ?? []);
  const reveal = $derived(online.state?.reveal ?? null);
  const twin = $derived(!!reveal?.twin);

  onMount(() => {
    const id = setTimeout(screenShake, 330);
    SFX.troll();
    vibrate([80, 60, 80]);
    return () => clearTimeout(id);
  });
</script>

<div class="grow"></div><span class="stamp red">{t("rdSurprise")}</span>
<div><h1 class="h1">{twin ? t("rdAllSame") : t("rdAllIntr")}</h1><p class="muted">{twin ? t("rdNoIntrTwin") : t("rdNoWord")}</p></div>
<!-- {@html} below: constant CONE artwork from game/art.ts, never user text -->
<div class="stage">{@html CONE}{#each players as p (p.id)}<div><Avatar player={{ a: 0, l: p.l }} size={48} /></div>{/each}</div>
{#if reveal}<div><p class="muted">{t("rdWordWas")}</p><p class="wordtag">{reveal.word}</p></div>{/if}
<div class="grow"></div>
<footer class="dock">
  {#if isHost()}<button class="btn go" onclick={() => send({ type: "outcome", kind: "troll" })}>{t("liContinue")}</button>
  {:else}<p class="note small muted">{t("olWaitingOutcome")}</p>{/if}
</footer>
