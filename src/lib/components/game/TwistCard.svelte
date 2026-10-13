<script lang="ts">
  import { t, tr } from "#lib/i18n/index.svelte.ts";
  /** Rule card of the round twist, shown on the discussion screen (twists without a rule text show nothing). */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { TWISTS } from "#lib/game/twists.ts";

  let { tw }: { tw: string | null } = $props();
  const twist = $derived(TWISTS.find((x) => x[0] == tw));
</script>

{#if twist && twist[2]}<div class="panel twc"
    ><div class="cr"><span class="ri"><Icon name="dice" /></span><div class="rt"><p class="rname">{t("rdTwist", { name: tr(twist[1]) })}</p><p class="rdesc">{tr(twist[2])}</p></div></div></div
  >{/if}
