<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** One-line reminder of the twist that was active, shown on the reveal screen (none for plain rounds). */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";

  /** `agent` and `base` let the online game give the agent's name and the intruder count it wants shown (this device's players are not the room's). */
  let { round, agent, base }: { round: any; agent?: string; base?: number } = $props();
  const tw: string | null = $derived(round.troll ? null : round.tw);
</script>

{#if tw === "ag"}<p class="starter"><Icon name="ghost" /><span>{t("rdAgent", { name: agent ?? playerName(round.da), word: round.word2 })}</span></p
  >{:else if tw === "ex"}<p class="starter"><Icon name="ghost" /><span>{t("rdExtra", { n: round.intr.length, k: base ?? state.k })}</span></p
  >{:else if tw === "dbl"}<p class="starter"><Icon name="dice" /><span>{t("rdDbl")}</span></p>{/if}
