<script lang="ts">
  import { t, tr } from "#lib/i18n/index.svelte.ts";
  /** "N runde până la designul …" hint on the scoreboard; nothing once every design is unlocked. */
  import { state } from "#lib/stores/settings.svelte.ts";
  import { CARD_DESIGNS, ALL_UNLOCKED } from "#lib/data/card-designs.ts";

  const next = CARD_DESIGNS.find((d) => !ALL_UNLOCKED && d[2] > state.rounds);
  const left = next ? next[2] - state.rounds : 0;
</script>

{#if next}<p class="muted small nxt">{t(left == 1 ? "rdNextDesignOne" : "rdNextDesign", { n: left, name: tr(next[1]) })}</p>{/if}
