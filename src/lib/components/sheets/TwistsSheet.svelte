<!-- All twists sheet: every twist a round can get. Opened from the Rules sheet, under the Twists switch. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Row from "#lib/components/ui/Row.svelte";
  import { t, tr } from "#lib/i18n/index.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { TWISTS } from "#lib/game/twists.ts";

  let { open }: { open: boolean } = $props();

  /** One icon per twist, so the rows can be told apart at a glance (ids are those of TWISTS). */
  const TWIST_ICONS: Record<string, string> = { sopt: "vol", rev: "chev", rep: "x", adj: "pencil", mima: "mime", neg: "no", blitz: "bolt", dbl: "star", voc: "mic", ag: "sleuth", ex: "mask" };
</script>

<Sheet {open} title={t("ruTwistsAll")} onclose={closeSheet} name="twists">
  <Panel class="twl">
    {#each TWISTS as tw (tw[0])}
      <Row icon={TWIST_ICONS[tw[0]] ?? "dice"} name={tr(tw[1])} description={tw[2] ? tr(tw[2]) : t("ruTwistSecret")} />
    {/each}
  </Panel>
  <button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
