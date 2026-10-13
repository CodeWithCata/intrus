<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { currentGroup } from "#lib/stores/groups.svelte.ts";
  import { customWordCount } from "#lib/components/categories/category-ui.ts";
  import { autoListName, saveWordList } from "#lib/stores/wordlists.svelte.ts";

  let { open }: { open: boolean } = $props();

  const n = $derived(customWordCount());
  const g = $derived(currentGroup());
</script>

<Sheet {open} title={t("lnTitle")} onclose={closeSheet} name="lname">
  {#snippet head()}<p class="muted small">{t(n == 1 ? "catWordOne" : "catWords", { n })}{g ? " · " + g.nm : ""}</p>{/snippet}
  <input class="custom" type="text" maxlength="24" placeholder={autoListName()} bind:value={state.ln} aria-label={t("lnTitle")} />
  <button class="btn go" onclick={saveWordList}>{t("grSave")}</button>
</Sheet>
