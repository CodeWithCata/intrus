<!-- Form to add custom words. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Icon from "#lib/components/ui/Icon.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { CATEGORIES } from "#lib/data/words/index.ts";
  import { addCustomWord, customWordCategory, parseCustomWords, removeCustomWord } from "#lib/stores/wordlists.svelte.ts";

  const words = $derived(parseCustomWords());
  const cats = $derived([...new Set([...CATEGORIES, ...words.map((e) => e.c).filter(Boolean)])]);
  let word = $state<HTMLInputElement>();

  function add() {
    addCustomWord();
    word?.focus();
  }

  function onenter(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }
</script>

<div class="cwa"
  ><p class="eyebrow">{t("cwTitle")}</p><div class="panel pad cwf"
    ><input class="custom" type="text" maxlength="30" placeholder={t("cwWord")} bind:value={appState.nw} bind:this={word} onkeydown={onenter} aria-label={t("cwWord")} /><input class="custom" type="text" maxlength="24" list="cwcats" placeholder={t("cwCat")} bind:value={appState.nc} onkeydown={onenter} aria-label={t("cwCatAria")} /><datalist id="cwcats">{#each cats as c, ki (ki)}<option value={c}></option>{/each}</datalist
    ><input class="custom" type="text" maxlength="50" placeholder={t("cwHint")} bind:value={appState.nh} onkeydown={onenter} aria-label={t("cwHintAria")} /><button class="btn go" onclick={add}><Icon name="plus" />{t("cwAdd")}</button><p class="muted small">{t("cwNote")}</p></div
  >{#if words.length}<div class="panel">{#each words as e, i (i)}<div class="cr"><span class="ri"><Icon name="pencil" /></span><div class="rt"><p class="rname">{e.w}</p><p class="rdesc">{customWordCategory(e)}{e.h ? " · " + e.h : ""}</p></div><button class="round" onclick={() => removeCustomWord(i)} aria-label={t("cwRemoveAria", { w: e.w })}><Icon name="x" /></button></div>{/each}</div>{/if}</div
>
