<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Icon from "#lib/components/ui/Icon.svelte";

  /**
   * The intruder stepper: - button, line-up of player pips (the lit ones are intruders), + button.
   * `onchange` gets -1 or +1; the buttons disable themselves at `min` and `max`.
   */
  let { value, min = 1, max, pips, onchange }: { value: number; min?: number; max: number; pips: boolean[]; onchange: (delta: -1 | 1) => void } = $props();
</script>

<div class="kstep"
  ><button class="round" id="km" onclick={() => onchange(-1)} aria-label={t("stFewer")} disabled={value <= min}><Icon name="minus" /></button
  ><div class="lineup" id="lu" aria-hidden="true">{#each pips as on, ki (ki)}<i class="pip" class:on></i>{/each}</div
  ><button class="round inc" id="kp" onclick={() => onchange(1)} aria-label={t("stMore")} disabled={value >= max}><Icon name="plus" /></button></div
>
