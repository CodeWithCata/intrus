<script lang="ts">
  import { getContext } from "svelte";
  import { iconParts } from "#lib/components/ui/icons.ts";

  let { name }: { name: string } = $props();
  // Set by Sheet.svelte: icons inside a bottom sheet are drawn at rest, without SMIL (it repaints the sheet's layer every frame).
  const inSheet = getContext<boolean | undefined>("sheet-icons") ?? false;
  // Same sprite lookup as icon(): inline the symbol's content so its SMIL animations run per use.
  const parts = $derived(iconParts(name, inSheet));
</script>

<!-- {@html} below: the constant icon sprite from app.html, never user text -->
{#if parts}<svg class="ic" viewBox={parts.viewBox} aria-hidden="true">{@html parts.inner}</svg>{:else}<svg class="ic" aria-hidden="true"><use href="#i-{name}" /></svg>{/if}
