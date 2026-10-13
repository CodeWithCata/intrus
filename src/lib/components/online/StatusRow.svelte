<script lang="ts">
  /** A row of avatars: the players in `done` are lit and ticked, the others dimmed ("who has seen their card / voted so far"). */
  import Avatar from "#lib/components/players/Avatar.svelte";

  let { players, done, size = 36 }: { players: { id: string; name: string; l: number }[]; done: string[]; size?: number } = $props();
</script>

<div class="statusrow" role="list">
  {#each players as p (p.id)}
    <span class="sp" class:done={done.includes(p.id)} role="listitem" title={p.name}
      ><Avatar player={{ a: 0, l: p.l }} {size} />{#if done.includes(p.id)}<span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>{/if}<span class="sr-only">{p.name}</span></span
    >
  {/each}
</div>
