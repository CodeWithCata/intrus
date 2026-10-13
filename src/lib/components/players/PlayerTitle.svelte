<script lang="ts">
  import { state } from "#lib/stores/settings.svelte.ts";

  /** The small custom title under a player's name ("Detectivul", ...); renders nothing when there is none. */
  let { i }: { i: number } = $props();
  const title = $derived((state.players[i].ti || "").trim());
</script>

{#if title}<small class="ptl">{title}</small>{/if}
