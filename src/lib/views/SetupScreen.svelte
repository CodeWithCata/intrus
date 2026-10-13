<!-- Home / setup screen: summary rows (players, groups, categories, rules, online) and the start button. -->
<script lang="ts">
  /**
   * Home / setup screen: hero, the row cards that open the bottom sheets, and the start button.
   * Markup and class names are identical to the former HTML-string template (the CSS targets them).
   * The summaries are markup over the reactive `state`, so they repaint on their own.
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import Hero from "#lib/components/layout/Hero.svelte";
  import QuestionMarks from "#lib/components/layout/QuestionMarks.svelte";
  import RematchCard from "#lib/components/groups/RematchCard.svelte";
  import SummaryCard from "#lib/components/setup/SummaryCard.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import AvatarStack from "#lib/components/players/AvatarStack.svelte";
  import { currentGroup } from "#lib/stores/groups.svelte.ts";
  import { CI } from "#lib/data/category-icons.ts";
  import { lbl } from "#lib/components/categories/category-ui.ts";
  import { rv } from "#lib/components/rules/rules-ui.ts";
  import { openSheet } from "#lib/components/ui/sheets.ts";
  import { start } from "#lib/game/engine.ts";
  import { installState, installOrExplain } from "#lib/stores/install.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  import { rematch } from "#lib/game/session.ts";

  const group = $derived(currentGroup());
  // "Revanșă": a small button on the Jucători row while the table is the same as last game; a full card only when it differs.
  const hasRc = $derived(!!state.rc && state.rc.pl?.length >= 3);
  const sameTable = $derived(hasRc && state.rc!.pl.length === state.players.length && state.rc!.pl.every((p, i) => p.n === state.players[i].n));
</script>

<header class="hero2"
  ><div class="icons"
    ><button class="hbtn" onclick={() => openSheet("help")} aria-label={t("suHelpAria")}><Icon name="help" /></button
    ><button class="hbtn" onclick={() => openSheet("set")} aria-label={t("suSettingsAria")}><Icon name="gear" /></button></div
  >
  <Hero /><QuestionMarks /><div class="ht"><h1 class="logo">INTRUS<span>{t("suLogoSub")}</span></h1><p class="tag">{t("suTagline")}</p></div></header
>
{#snippet rematchAction()}<button class="rmact" onclick={rematch}><Icon name="redo" />{t("suRematch")}</button>{/snippet}
<main class="page2">
  {#if installState.mode !== "none"}<SummaryCard icon="install" title={installState.mode === "ios" ? t("instIosTitle") : t("install")} id="inst" onclick={installOrExplain}>{installState.mode === "ios" ? t("instIosSteps") : t("instShort")}</SummaryCard>{/if}
  {#if hasRc && !sameTable}<RematchCard />{/if}<SummaryCard icon="users" title={t("suPlayers")} id="pv" onclick={() => openSheet("players")} action={sameTable ? rematchAction : undefined}><AvatarStack players={state.players} count={5} size={28} />{t("suPlayersN", { n: state.players.length })}</SummaryCard><SummaryCard icon="saved" title={t("suGroups")} id="gv" onclick={() => openSheet("groups")}>{#if group}<AvatarStack players={group.pl} count={3} size={32} />{group.nm}{:else if state.groups.length}{t(state.groups.length > 1 ? "suGroupMany" : "suGroupOne", { n: state.groups.length })}{:else}{t("suSaveTeam")}{/if}</SummaryCard><SummaryCard icon="folder" title={t("suCats")} id="catval" onclick={() => openSheet("cats")}><span class="stk">{#each state.cats.slice(0, 3) as c, ki (ki)}<span><Icon name={CI[c]} /></span>{/each}</span>{lbl()}</SummaryCard><SummaryCard icon="dossier" title={t("suRules")} id="rv" onclick={() => openSheet("rules")}>{rv()}</SummaryCard><SummaryCard icon="online" title={t("suOnline")} id="ol0" onclick={() => openSheet("online")}>{t("suOnlineDesc")}</SummaryCard>
</main>
<footer class="dock"
  ><button class="btn go" onclick={start}><Icon name="play" />{t("suStart")}</button><div class="note sumrow" id="sum"
    ><span class="chip2"><Icon name="users" /><b>{state.players.length}</b> {t("suPlayersWord")}</span><span class="chip2"><Icon name="mask" /><b>{state.k}</b> {t(state.k > 1 ? "suIntruderMany" : "suIntruderOne")}</span><span class="chip2"><Icon name="clock" />{#if state.tm}<b>{state.tm}</b> {t("suMin")}{:else}{t("suNoTimer")}{/if}</span></div
  ></footer
>
