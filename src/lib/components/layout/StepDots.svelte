<script lang="ts">
  /** Progress dots of the pass/vote screens: one dot per player, lit up to the current one. */
  let { count, current }: { count: number; current: number } = $props();
</script>

<div class="steps" aria-hidden="true">{#each { length: count } as _, j (j)}<i class={j <= current ? "on" : ""}></i>{/each}</div>
