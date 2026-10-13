<!-- Group stats sheet: standings and awards for a saved group. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Row from "#lib/components/ui/Row.svelte";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { groupById } from "#lib/stores/groups.svelte.ts";
  import { displayName } from "#lib/utils/id.ts";
  import { awards, deleteGroup, loadGroup, playGroup, renameGroup, standings } from "#lib/components/groups/groups.ts";

  let { open }: { open: boolean } = $props();

  const g = $derived(groupById(state.gv));
  const rows = $derived(g ? standings(g) : []);
  const prizes = $derived(g ? awards(g) : []);
</script>

<Sheet {open} title={g?.nm ?? ""} onclose={closeSheet} name="gstats">
  {#snippet head()}{#if g}<p class="muted small">{t(g.st.r == 1 ? "grRoundOne" : "grRounds", { r: g.st.r })} · {t(g.st.s == 1 ? "grSeriesOne" : "grSeriesMany", { n: g.st.s })}</p>{/if}{/snippet}
  {#snippet aside()}{#if g}<button class="pillbtn" onclick={() => renameGroup(g.id)}>{t("grRename")}</button>{/if}{/snippet}
  {#if g}
    <div class="stack gst">
      <p class="eyebrow first">{t("grStanding")}</p>
      <Panel>{#each rows as x, k (k)}<div class="cr"><span class="rank">{#if k == 0 && x.q.pt}<Icon name="crown" />{:else}{k + 1}{/if}</span><Avatar player={x.p} size={40} /><div class="rt"><p class="rname">{displayName(x.p, x.i)}</p><p class="rdesc">{t("grRounds", { r: x.q.r })} · {t(x.q.w == 1 ? "grWonOne" : "grWonMany", { n: x.q.w })}</p></div><span class="tot">{x.q.pt}</span></div>{/each}</Panel>
      {#if prizes.length}
        <p class="eyebrow">{t("grPrizes")}</p>
        <Panel>{#each prizes as a, ki (ki)}<Row icon={a.icon} name={a.title} description={a.text} />{/each}</Panel>
      {:else}
        <p class="muted small pcap">{t("grNoPrizes")}</p>
      {/if}
      <button class="link full" onclick={() => loadGroup(g.id)}>{t("grLoad")}</button>
      <button class="link full" onclick={() => deleteGroup(g.id)}>{t("grDelete")}</button>
    </div>
  {/if}
  <button class="btn go" onclick={() => playGroup(state.gv as string)}><Icon name="redo" />{t("suRematch")}</button>
</Sheet>
