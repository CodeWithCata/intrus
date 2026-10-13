<script lang="ts">
  /** A confirmation sheet: text, a cancel button and a confirm button. */
  import Sheet from "#lib/components/ui/Sheet.svelte";

  let { open, title, text, confirm, cancel = "Anulează", onconfirm, onclose }: { open: boolean; title: string; text: string; confirm: string; cancel?: string; onconfirm: () => void; onclose: () => void } = $props();
</script>

<Sheet {open} {title} {onclose} name="ask">
  <p class="muted">{text}</p>
  <div class="acts"><button class="btn" onclick={onclose}>{cancel}</button><button class="btn go" onclick={onconfirm}>{confirm}</button></div>
</Sheet>
