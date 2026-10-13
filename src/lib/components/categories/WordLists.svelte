<!-- Saved word lists block (use, delete, new, share, import). -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Icon from "#lib/components/ui/Icon.svelte";
  import { currentGroup } from "#lib/stores/groups.svelte.ts";
  import { customWordCount } from "#lib/components/categories/category-ui.ts";
  import { openImport, openShare } from "#lib/stores/list-share.svelte.ts";
  import { deleteWordList, newWordList, readWordLists, useWordList, wordCount } from "#lib/stores/wordlists.svelte.ts";

  const g = $derived(currentGroup());
  const lists = $derived(readWordLists());
  const n = $derived(customWordCount());
</script>

<div class="wl"
  ><p class="eyebrow">{g ? t("wlFor", { name: g.nm }) : t("wlSaved")}</p><div class="panel"
    >{#each lists as l, ki (ki)}<div class="cr"
        ><button class="wlm" onclick={() => useWordList(l.id)} aria-label={t("wlUse", { name: l.nm })}
          ><span class="ri"><Icon name="saved" /></span><span class="rt"><span class="rname">{l.nm}</span><span class="rdesc">{t(wordCount(l) == 1 ? "catWordOne" : "catWords", { n: wordCount(l) })} · {l.w.split(", ").slice(0, 3).map((x: string) => x.split("|")[0]).join(", ")}{wordCount(l) > 3 ? "…" : ""}</span></span></button
        ><button class="round" onclick={() => openShare(l.id)} aria-label={t("wlShare", { name: l.nm })}><Icon name="qr" /></button
        ><button class="round" onclick={() => deleteWordList(l.id)} aria-label={t("wlDelete", { name: l.nm })}><Icon name="x" /></button></div
      >{/each}{#if n}<button class="addrow" onclick={newWordList}><span class="plus"><Icon name="plus" /></span>{t("wlSaveCurrent")}</button>{/if}<button class="addrow" onclick={openImport}><span class="plus"><Icon name="plus" /></span>{t("liImport")}</button></div
  >{#if !lists.length && !n}<p class="muted small wlnote">{t("wlNote1")}</p>{/if}{#if !g}<p class="muted small wlnote">{t("wlNote2")}</p>{/if}</div
>
