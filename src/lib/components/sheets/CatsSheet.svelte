<!-- Categories sheet: pick word categories (all / none / custom words). -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Tick from "#lib/components/ui/Tick.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import SwitchRow from "#lib/components/sheets/SwitchRow.svelte";
  import { toggleOption } from "#lib/components/settings/settings.ts";
  import CustomWordForm from "#lib/components/categories/CustomWordForm.svelte";
  import WordLists from "#lib/components/categories/WordLists.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { CATEGORIES } from "#lib/data/words/index.ts";
  import { catName } from "#lib/data/category-names.ts";
  import { locale, t } from "#lib/i18n/index.svelte.ts";
  import { CI } from "#lib/data/category-icons.ts";
  import { activeCategoryCount, sparkBurst } from "#lib/animations/motion.ts";
  import { Flash } from "#lib/components/ui/flash.svelte.ts";
  import { flushSync } from "svelte";
  import { nudge } from "#lib/components/categories/nudge.svelte.ts";
  import { cats as catsFn, catNote, countText, cuTxt, toggleAllCategories, toggleCategory, toggleCustomWords } from "#lib/components/categories/category-ui.ts";

  let { open }: { open: boolean } = $props();

  /* A tapped tile pops and stays popped (the CSS entrance animation only applies to `.cat:not(.pop)`). */
  const pops = CATEGORIES.map(() => new Flash());
  const cuPop = new Flash();
  /* `start()` with no category selected: the note shakes. */
  const noteNudge = new Flash(450);
  let seenNudge = nudge.n;
  $effect(() => {
    const n = nudge.n;
    if (n !== seenNudge) {
      seenNudge = n;
      noteNudge.fire();
    }
  });
  /* The tiles on offer: all of them in Romanian, only the ones that have a list in another language. */
  const cats = $derived(catsFn());
  const tiles: HTMLElement[] = $state([]);
  let cuTile: HTMLElement;
  let cuInput: HTMLInputElement;

  function pickCategory(c: string, i: number) {
    toggleCategory(c);
    pops[i].fire();
    if (appState.cats.includes(c)) {
      sparkBurst(tiles[i]);
    }
  }

  function pickAll() {
    const all = cats.every((c) => appState.cats.includes(c));
    toggleAllCategories();
    pops.forEach((p, i) =>
      setTimeout(() => {
        p.fire();
        if (!all) {
          sparkBurst(tiles[i]);
        }
      }, i * 55)
    );
  }

  function pickCustom() {
    toggleCustomWords();
    cuPop.fire();
    if (appState.cu) {
      sparkBurst(cuTile);
      flushSync();
      cuInput?.focus();
    }
  }
</script>

<Sheet {open} title={t("suCats")} onclose={closeSheet} name="cats">
  {#snippet head()}<p class="muted small" class:warn={!activeCategoryCount()} class:nudge={noteNudge.on} id="cn">{catNote()}</p>{/snippet}
  {#snippet aside()}<button class="pillbtn" id="ca" onclick={pickAll}>{cats.every((c) => appState.cats.includes(c)) ? t("csNone") : t("catAll")}</button>{/snippet}
<div class="cats">
  {#each cats as c, i (i)}<button class="cat" class:pop={pops[i].on} bind:this={tiles[i]} style="--c:{i}" onclick={() => pickCategory(c, i)} aria-pressed={appState.cats.includes(c)}><span class="cic"><Icon name={CI[c]} /></span><span class="cn">{catName(c, locale.words)}</span><small>{countText(c)}</small><Tick /></button>{/each}<button class="cat wide" class:pop={cuPop.on} bind:this={cuTile} style="--c:6" onclick={pickCustom} aria-pressed={appState.cu}><span class="cic"><Icon name="pencil" /></span><span class="tx"><span class="cn">{t("csCustom")}</span><small id="cuc">{cuTxt()}</small></span><Tick /></button>
</div>
<Panel><SwitchRow icon="balloon" title={t("csParty")} desc={t("csPartyDesc")} checked={appState.pty} onchange={() => toggleOption("pty")} /></Panel>
{#if appState.pty}<div class="cats"><button class="cat wide" onclick={() => toggleCategory("Petrecere")} aria-pressed={appState.cats.includes("Petrecere")}><span class="cic"><Icon name={CI["Petrecere"]} /></span><span class="tx"><span class="cn">{catName("Petrecere", locale.words)}</span><small>{countText("Petrecere")}</small></span><Tick /></button></div>{/if}
<div id="cw" hidden={!appState.cu}><input class="custom" type="text" placeholder={t("csCustomPlaceholder")} bind:this={cuInput} bind:value={appState.custom} aria-label={t("csCustom")} /><CustomWordForm /><WordLists /></div>
<button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
