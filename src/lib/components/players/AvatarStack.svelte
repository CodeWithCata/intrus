<script lang="ts">
  import Avatar from "#lib/components/players/Avatar.svelte";
  import type { Player } from "#lib/game/types.ts";

  /** The overlapping row of avatars (`.avs`) shown on the home cards and in the group lists. */
  let { players, count, size }: { players: Player[]; count: number; size: number } = $props();
</script>

<span class="avs">{#each players.slice(0, count) as p, ki (ki)}<Avatar player={p} {size} />{/each}</span>
