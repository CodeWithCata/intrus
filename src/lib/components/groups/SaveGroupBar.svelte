<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** "Salvează grupul" row on the scoreboard; hidden when the players already belong to a saved group. */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { currentGroup } from "#lib/stores/groups.svelte.ts";
  import { openGroupNameSheet } from "#lib/components/groups/groups.ts";

  const saved = !!currentGroup();
</script>

{#if !saved}<button class="sum" onclick={() => openGroupNameSheet(true)}
    ><span class="ri"><Icon name="saved" /></span><span class="rt"><span class="rname">{t("grSaveGroup")}</span><span class="sv">{t("grKeepStats")}</span></span><Icon name="chev" /></button
  >{/if}
