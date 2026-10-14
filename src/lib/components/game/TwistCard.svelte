
<script lang="ts">
  import { t, tr } from "#lib/i18n/index.svelte.ts";
  /** Rule card of the round twist, shown on the discussion screen (twists without a rule text show nothing). `persona` is the character of the "Voce de personaj" twist (an index into PERSONAS). */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { TWISTS } from "#lib/game/twists.ts";
  import { PERSONAS } from "#lib/game/twist-rules.ts";

  let { tw, persona = null }: { tw: string | null; persona?: number | null } = $props();
  const twist = $derived(TWISTS.find((x) => x[0] == tw));
  const who = $derived(tw === "voc" && persona != null ? PERSONAS[persona] : undefined);
</script>

{#if twist && twist[2]}<div class="panel twc"
    ><div class="cr"><span class="ri"><Icon name="dice" /></span><div class="rt"><p class="rname">{t("rdTwist", { name: tr(twist[1]) })}</p><p class="rdesc">{tr(twist[2])}</p>{#if who}<p class="rdesc"><strong>{t("rdPersona", { v: tr(who) })}</strong></p>{/if}</div></div></div
  >{/if}
