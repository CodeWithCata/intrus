<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** Header of the pass and vote screens: quit button, "<label> i din n" and the step dots. */
  import Icon from "#lib/components/ui/Icon.svelte";
  import StepDots from "#lib/components/layout/StepDots.svelte";
  import { quitRound } from "#lib/game/session.ts";

  let { i, n, label }: { i: number; n: number; label: "rdTopPlayer" | "rdTopVote" } = $props();
</script>

<header
  ><div class="bar"><button class="round" onclick={quitRound} aria-label={t("rdQuitAria")}><Icon name="x" /></button><p class="muted small">{t(label, { i: i + 1, n })}</p><span class="sp"></span></div>
  <StepDots count={n} current={i} /></header
>
