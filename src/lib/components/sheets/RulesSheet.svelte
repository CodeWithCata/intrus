<!-- Rules sheet: timer preset, intruder count, hint mode, vote mode, troll round. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Segmented from "#lib/components/ui/Segmented.svelte";
  import { Flash } from "#lib/components/ui/flash.svelte.ts";
  import SwitchRow from "#lib/components/sheets/SwitchRow.svelte";
  import Stepper from "#lib/components/rules/Stepper.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { closeSheet, openSheet } from "#lib/components/ui/sheets.ts";
  import { sum } from "#lib/components/categories/category-ui.ts";
  import { lineupOn } from "#lib/components/players/lineup.ts";
  import { HD, HL, HM, TIMES, maxIntruders, setHintMode, setTimer, setVoteMode, stepIntruders, toggleTroll } from "#lib/components/rules/rules-ui.ts";
  import { toggleOption } from "#lib/components/settings/settings.ts";
  import { t, tr } from "#lib/i18n/index.svelte.ts";
  import { partnersAvailable } from "#lib/game/twins.ts";

  let { open }: { open: boolean } = $props();

  const n = $derived(state.players.length);
  const mx = $derived(maxIntruders(n));
  const pips = $derived.by(() => {
    const on = lineupOn();
    return state.players.map((_, i) => on.has(i));
  });
  const times = $derived(TIMES.map((v) => [v, v ? v + " " + t("suMin") : t("ruNone")] as const));
  const voteModes = $derived([["seq", t("ruTurn")], ["sim", t("ruSim")]] as const);
  const canPartners = $derived(partnersAvailable(n, state.k));
  const partnersDesc = $derived(state.twn ? t("ruKnowNoTwins") : canPartners ? t("ruKnowOk") : t("ruKnowNeed"));
  const hints = $derived(HM.map((v, i) => [v, tr(HL[i])] as const));

  /** The changed values bump for a moment. */
  const kv = new Flash(300);
  const tv = new Flash(300);
  const hd = new Flash(300);
</script>

<Sheet {open} title={t("suRules")} onclose={closeSheet} name="rules">
  {#snippet head()}<p class="muted small" id="rsum">{sum()}</p>{/snippet}
<div class="stack">
  <p class="eyebrow first">{t("ruRoles")}</p>
  <Panel tag="section" class="pad rc">
    <div class="rh"><span class="ri"><Icon name="mask" /></span><div class="rt"><p class="rname">{t("ruIntruders")}</p><p class="rdesc">{t("ruIntrudersDesc")}</p></div><p class="val"><b id="kv" class:bump={kv.on}>{state.k}</b><small>{t("ruOutOf", { n })}</small></p></div>
    <Stepper value={state.k} max={mx} {pips} onchange={(d) => { stepIntruders(d); kv.fire(); }} />
    <p class="kcap small muted">{t("ruMax", { mx, w: t(mx > 1 ? "suIntruderMany" : "suIntruderOne"), n })}</p>
  </Panel>
  <p class="eyebrow">{t("ruDiscussion")}</p>
  <Panel tag="section" class="pad rc">
    <div class="rh"><span class="ri"><Icon name="clock" /></span><div class="rt"><p class="rname">{t("ruTime")}</p><p class="rdesc">{t("ruTimeDesc")}</p></div><p class="val" id="tv" class:bump={tv.on}>{#if state.tm}<b>{state.tm}</b><small>{t("suMin")}</small>{:else}<b>∞</b><small>{t("ruFree")}</small>{/if}</p></div>
    <Segmented pop options={times} value={state.tm} onpick={(v) => { setTimer(v); tv.fire(); }} />
  </Panel>
  <Panel>
    <SwitchRow icon="crown" title={t("ruWheel")} desc={state.rx ? t("ruWheelRx") : t("ruWheelDesc")} checked={state.wh} off={state.rx} hook="wheel" onchange={() => toggleOption("wh")} />
  </Panel>
  <p class="eyebrow">{t("ruVote")}</p>
  <Panel tag="section" class="pad rc">
    <div class="rh"><span class="ri"><Icon name="search" /></span><div class="rt"><p class="rname">{t("ruVoteMode")}</p><p class="rdesc">{state.vm === "sim" ? t("ruVoteSim") : t("ruVoteSeq")}</p></div></div>
    <Segmented pop id="vms" options={voteModes} value={state.vm} onpick={setVoteMode} />
  </Panel>
  <Panel>
      <SwitchRow icon="bolt" title={t("ruDrama")} desc={t("ruDramaDesc")} checked={state.dr} onchange={() => toggleOption("dr")} />
  </Panel>
  <p class="eyebrow">{t("ruHint")}</p>
  <Panel tag="section" class="pad rc">
    <div class="rh"><span class="ri"><Icon name="bulb" /></span><div class="rt"><p class="rname">{t("ruHintFor")}</p><p class="rdesc" id="hd" class:bump={hd.on}>{tr(HD[state.hint])}</p></div></div>
    <Segmented pop id="hs" options={hints} value={state.hint} onpick={(v) => { setHintMode(v); hd.fire(); }} />
  </Panel>
  <p class="eyebrow">{t("ruExtra")}</p>
  <Panel>
    <SwitchRow icon="troll" title={t("ruTroll")} desc={n < 4 ? t("ruTrollNeed") : t("ruTrollDesc")} checked={state.troll} off={n < 4} hook="troll" onchange={toggleTroll} />
    <SwitchRow icon="dice" title={t("ruTwists")} desc={t("ruTwistsDesc")} checked={state.tw} onchange={() => toggleOption("tw")} />
    <button class="cr nav" disabled={!state.tw} onclick={() => openSheet("twists")}><span class="rt">{t("ruTwistsSee")}</span><span class="navv">{state.tw ? t("ruTwistsSeeOn") : t("ruTwistsSeeOff")}</span><span class="nvi"><Icon name="chev" /></span></button>
    <SwitchRow icon="mask" title={t("ruTwins")} desc={state.kn ? t("ruTwinsDescKn") : t("ruTwinsDesc")} checked={state.twn} off={state.kn} onchange={() => toggleOption("twn")} />
    <SwitchRow icon="users" title={t("ruKnow")} desc={partnersDesc} checked={state.kn} off={!canPartners || state.twn} onchange={() => toggleOption("kn")} />
    <SwitchRow icon="help" title={t("ruQuestions")} desc={t("ruQuestionsDesc")} checked={state.qm} onchange={() => toggleOption("qm")} />
  </Panel>
</div>
<button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
