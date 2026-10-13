<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import AvatarStack from "#lib/components/players/AvatarStack.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { openGroupNameSheet, openGroupStats, playGroup } from "#lib/components/groups/groups.ts";

  let { open }: { open: boolean } = $props();
</script>

<Sheet {open} title={t("suGroups")} onclose={closeSheet} name="groups">
  {#snippet head()}<p class="muted small">{state.groups.length ? t("grTapStats") : t("grSaveToTrack")}</p>{/snippet}
<Panel class="pl">
  {#each state.groups as g, ki (ki)}<div class="cr"><button class="gmain" onclick={() => openGroupStats(g.id)}><AvatarStack players={g.pl} count={3} size={40} /><span class="rt"><span class="rname">{g.nm}</span><span class="rdesc">{t("suPlayersN", { n: g.pl.length })} · {t(g.st.r == 1 ? "grRoundOne" : "grRounds", { r: g.st.r })}</span></span></button><button class="pillbtn" onclick={() => playGroup(g.id)}>{t("grPlay")}</button></div>{/each}<button class="addrow" onclick={() => openGroupNameSheet()}><span class="plus"><Icon name="plus" /></span>{t("grSaveCurrent")}</button>
</Panel>
<button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
