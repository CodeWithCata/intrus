<script lang="ts">
  /** The back of the card in the design the player picked (artwork lives in data/card-designs.ts). */
  import { cdBack } from "#lib/data/card-designs.ts";

  const html = cdBack();
</script>

<!-- {@html} below: constant card-back artwork from data/card-designs.ts, never user text -->
{@html html}
