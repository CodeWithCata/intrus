<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { autoGroupName } from "#lib/stores/groups.svelte.ts";
  import { saveGroup } from "#lib/components/groups/groups.ts";

  let { open }: { open: boolean } = $props();
</script>

<Sheet {open} title={state.ge ? t("grRename") : t("grNameTitle")} onclose={closeSheet} name="gname">
  {#snippet head()}<p class="muted small">{autoGroupName()}</p>{/snippet}
  <input class="custom" type="text" maxlength="24" placeholder={autoGroupName()} bind:value={state.gn} aria-label={t("grNameTitle")} />
  <button class="btn go" onclick={saveGroup}>{t("grSave")}</button>
</Sheet>
