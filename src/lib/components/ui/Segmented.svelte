<script lang="ts">
  import { Flash } from "#lib/components/ui/flash.svelte.ts";

  /**
   * A segmented control. `value` is bindable; `onpick` gets the chosen value; `pop` makes the tapped button pop.
   * --i drives the sliding pill; --n (the column count, CSS default 4) is set for every count except 4, so 2, 3 and 5+ options fill the whole bar.
   */
  let { options, value = $bindable(), onpick, id, two = false, pop = false }: { options: readonly (readonly [string | number, string])[]; value: string | number; onpick?: (value: any) => void; id?: string; two?: boolean; pop?: boolean } = $props();
  const popped = new Flash(450);
  const index = $derived(options.findIndex(([v]) => v == value));
</script>

<div class={two ? "seg two" : "seg"} {id} style:--i={index} style:--n={options.length !== 4 ? options.length : null}>{#each options as [v, l], i (i)}<button class:pop={popped.key === i} onclick={() => { value = v; if (pop) { popped.fire(i); } onpick?.(v); }} aria-pressed={value == v}>{l}</button>{/each}</div>
