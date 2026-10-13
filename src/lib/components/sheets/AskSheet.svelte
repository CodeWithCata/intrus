<script lang="ts">
  import ConfirmSheet from "#lib/components/ui/ConfirmSheet.svelte";
  import { askState, confirmAsk } from "#lib/stores/ask.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";

  let { open }: { open: boolean } = $props();
</script>

<ConfirmSheet {open} title={askState.t} text={askState.d} confirm={askState.y} onconfirm={confirmAsk} onclose={closeSheet} />
