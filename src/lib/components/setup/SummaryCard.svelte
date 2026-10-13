<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "#lib/components/ui/Icon.svelte";

  /**
   * One tappable row of the home screen ("Jucători", "Reguli", ...). The children are the live
   * summary (avatars, chips): they read the reactive state, so they repaint themselves.
   */
  let { icon, title, id, onclick, children, action }: { icon: string; title: string; id: string; onclick: () => void; children: Snippet; action?: Snippet } = $props();
</script>

{#snippet row()}<button class="sum" {onclick}
  ><span class="ri"><Icon name={icon} /></span
  ><span class="rt"><span class="rname">{title}</span><span class="sv" {id}>{@render children()}</span></span
  ><Icon name="chev" /></button
>{/snippet}
{#if action}<div class="sumw">{@render row()}{@render action()}</div>{:else}{@render row()}{/if}
