<script lang="ts">
  import type { Snippet } from "svelte";

  /** The .panel card. `class` adds modifiers ("pad", "pl", "pad rc"); `tag` is the element (div or section). */
  let { class: cls = "", tag = "div", children }: { class?: string; tag?: "div" | "section"; children?: Snippet } = $props();
</script>

<svelte:element this={tag} class={cls ? "panel " + cls : "panel"}>{@render children?.()}</svelte:element>
