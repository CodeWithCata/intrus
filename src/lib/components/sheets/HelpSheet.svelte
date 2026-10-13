<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";

  let { open }: { open: boolean } = $props();

  const steps = $derived([
    [t("hlS1T"), t("hlS1D")],
    [t("hlS2T"), t("hlS2D")],
    [t("hlS3T"), state.qm ? t("hlS3Dq") : t("hlS3Dw")],
    [t("hlS4T"), t("hlS4D")]
  ]);
</script>

<Sheet {open} title={t("suHelpAria")} onclose={closeSheet} name="help">
  <ol class="steps2">{#each steps as [st, sd], i (i)}<li><span class="no">{i + 1}</span><div><p class="rname">{st}</p><p class="rdesc">{sd}</p></div></li>{/each}</ol>
  <button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
