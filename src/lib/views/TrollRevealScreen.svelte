<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** Reveal screen of the "everybody was an intruder" surprise round (no points are awarded). */
  import QuitBar from "#lib/components/layout/QuitBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { CONE } from "#lib/components/game/art.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { end } from "#lib/game/engine.ts";

  let { word, twin = false }: { word: string; twin?: boolean } = $props();
</script>

<section class="screen center"
  ><QuitBar />
  <div class="grow"></div><span class="stamp red">{t("rdSurprise")}</span>
  <div><h1 class="h1">{twin ? t("rdAllSame") : t("rdAllIntr")}</h1><p class="muted">{twin ? t("rdNoIntrTwin") : t("rdNoWord")}</p></div>
  <!-- {@html} below: constant CONE artwork from game/art.ts, never user text -->
  <div class="stage">{@html CONE}{#each state.players as p, ki (ki)}<div><Avatar player={p} size={48} /></div>{/each}</div>
  <div><p class="muted">{t("rdWordWas")}</p><p class="wordtag">{word}</p></div>
  <div class="grow"></div>
  <footer class="dock"><button class="btn go" onclick={() => end(-1)}>{t("liContinue")}</button></footer></section
>
