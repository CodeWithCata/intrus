<script lang="ts">
  /** A row of single-choice chips. `onpick` gets the chosen key. */
  let { items, active, onpick, disabled = false }: { items: readonly (readonly string[])[]; active: string; onpick: (key: string) => void; disabled?: boolean } = $props();
</script>

<div class="chips">{#each items as [k, l], ki (ki)}<button class="chip" onclick={() => onpick(k)} aria-pressed={active == k} {disabled}>{l}</button>{/each}</div>
