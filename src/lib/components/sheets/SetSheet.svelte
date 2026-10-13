<!-- Settings sheet: theme, accent, reveal, card design, tick style, switches, volume. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Check from "#lib/components/ui/Check.svelte";
  import Lock from "#lib/components/ui/Lock.svelte";
  import SwitchRow from "#lib/components/sheets/SwitchRow.svelte";
  import Chips from "#lib/components/sheets/Chips.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { VOICE_SUPPORTED } from "#lib/voice/host.ts";
  import { CDB, CARD_DESIGNS, lk } from "#lib/data/card-designs.ts";
  import { TKS, tkTxt } from "#lib/audio/tick-styles.ts";
  import { RB, RS } from "#lib/audio/reveal-sounds.ts";
  import { THEMES, ACCS, RV, volTxt, rsTxt, rbTxt, pickTheme, pickAccent, pickRevealAnim, pickRevealSound, pickRevealBuzz, chooseCardDesign, pickTick, toggleOption, setVolume, showIntro } from "#lib/components/settings/settings.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { sparkBurst } from "#lib/animations/motion.ts";
  import { Flash } from "#lib/components/ui/flash.svelte.ts";
  import Row from "#lib/components/ui/Row.svelte";
  import { installState, installOrExplain } from "#lib/stores/install.svelte.ts";
  import Segmented from "#lib/components/ui/Segmented.svelte";
  import { languageOptions, locale, setLang, t, tr, type Lang } from "#lib/i18n/index.svelte.ts";

  let { open }: { open: boolean } = $props();

  /** A locked design the player tapped stays on show in the preview until another one is picked. */
  let preview = $state<string | null>(null);
  const cur = $derived(preview || appState.cd);
  const dn = $derived(CARD_DESIGNS.find((d) => d[0] == cur) || CARD_DESIGNS[0]);
  const locked = $derived(lk(dn));
  const vol = $derived(Math.round(appState.vol * 100));
  const rvItems = $derived(Object.entries(RV).map(([k, r]) => [k, tr(r.l)] as const));
  const rsItems = $derived(RS.map(([k, l]) => [k, tr(l)] as const));
  const rbItems = $derived(RB.map(([k, l]) => [k, tr(l)] as const));
  const tkItems = $derived(Object.entries(TKS).map(([k, v]) => [k, tr(v[0])] as const));

  /** The accent swatches pop (and spark) when tapped. */
  const accPops = ACCS.map(() => new Flash(450));
  const accEls: HTMLElement[] = [];

  function accent(c: string, i: number) {
    pickAccent(c);
    accPops[i].fire();
    sparkBurst(accEls[i]);
  }

  function pickDesign(id: string) {
    preview = id;
    if (chooseCardDesign(id)) {
      preview = null;
    }
  }
</script>

<Sheet {open} title={t("stTitle")} onclose={closeSheet} name="set">
  {#snippet head()}<p class="muted small">{t("stSubtitle")}</p>{/snippet}
  <div class="stack">
    {#if languageOptions().length > 1}
      <Panel class="pad"><p class="eyebrow first">Limbă / Language</p><Segmented two={languageOptions().length === 2} options={languageOptions()} value={locale.lang} onpick={(l: Lang) => setLang(l)} /></Panel>
    {/if}
    {#if installState.mode !== "none"}
      <Panel>
        <Row icon="install" name={installState.mode === "ios" ? t("instIosTitle") : t("install")} description={installState.mode === "ios" ? t("instIosSteps") : t("instDesc")}>
          {#snippet control()}{#if installState.mode === "prompt" || installState.mode === "manual"}<button class="pillbtn" onclick={installOrExplain}>{t("instBtn")}</button>{/if}{/snippet}
        </Row>
      </Panel>
    {/if}
    <p class="eyebrow first">{t("stTheme")}</p>
    <Panel class="pad"><div class="themes">{#each THEMES as [v, l], ki (ki)}<button class="th" onclick={() => pickTheme(v)} data-t={v} aria-pressed={appState.theme == v}><span class="tp"><i></i><i></i><i></i></span>{tr(l)}<Check /></button>{/each}</div></Panel>
    <p class="eyebrow">{t("stAccent")}</p>
    <Panel class="pad"><div class="accs">{#each ACCS as [c, l], i (i)}<button class="ac" class:pop={accPops[i].on} bind:this={accEls[i]} style="--c:{c}" onclick={() => accent(c, i)} aria-pressed={appState.acc == c} aria-label={tr(l)}><Check /></button>{/each}</div></Panel>
    <p class="eyebrow">{t("stSoundVib")}</p>
    <Panel>
      <SwitchRow icon="sound" title={t("stSound")} desc={t("stSoundDesc")} checked={appState.snd} fx="snd" onchange={() => toggleOption("snd")} />
      <div class="cr col" class:off={!appState.snd} id="volrow"
        ><span class="ri"><Icon name="vol" /></span
        ><div class="rt"><p class="rname">{t("stVolume")}</p><p class="rdesc" id="vold">{volTxt()}</p></div
        ><b class="vp" id="vp">{vol}%</b
        ><input class="vol" id="volin" type="range" min="0" max="100" step="5" value={vol} oninput={(e) => setVolume(+e.currentTarget.value)} onchange={() => beep(660, 0.1)} style="--p:{vol}%" aria-label={t("stVolume")} aria-describedby="vold" disabled={!appState.snd} /></div
      >
      <SwitchRow icon="buzz" title={t("stVib")} desc={t("stVibDesc")} checked={appState.vb} fx="vb" onchange={() => toggleOption("vb")} />
      <SwitchRow icon="vol" title={t("stVoice")} desc={VOICE_SUPPORTED ? t("stVoiceDesc") : t("stVoiceNo")} checked={appState.vh} off={!VOICE_SUPPORTED} onchange={() => toggleOption("vh")} />
    </Panel>
    <p class="eyebrow">{t("stVoteCard")}</p>
    <Panel>
      <SwitchRow icon="users" title={t("stGive")} desc={t("stGiveDesc")} checked={appState.gt} onchange={() => toggleOption("gt")} />
      <SwitchRow icon="mask" title={t("stPeek")} desc={t("stPeekDesc")} checked={appState.pv} onchange={() => toggleOption("pv")} />
    </Panel>
    <p class="eyebrow">{t("stDesign")}</p>
    <Panel class="pad">
      <!-- {@html} below: constant card-back artwork from data/card-designs.ts, never user text -->
      <div class="cdp">
        <div class="mc"><div class="card" data-cd={cur}>{@html CDB[cur as keyof typeof CDB]()}</div><small>{t("stBack")}</small></div>
        <div class="mc"><div class="card open civ" data-cd={cur}><div class="face"><p class="secret">Pizza</p></div></div><small>{t("stWord")}</small></div>
        <div class="mc"><div class="card open bad" data-cd={cur}><div class="face"><span class="stamp">{t("stStamp")}</span></div></div><small>{t("stIntruderCap")}</small></div>
      </div>
      <p class="rdesc cdn">{#if locked}<Lock /> {t("stUnlock", { n: dn[2] })}{:else}{tr(dn[1]) + (appState.cd == cur ? " · " + t("stActive") : "")}{/if}</p>
      <!-- {@html} below: constant card-back artwork from data/card-designs.ts, never user text -->
      <div class="cdg">{#each CARD_DESIGNS as d, ki (ki)}{@const l = lk(d)}<button class="cdt" class:lk={l} class:pv={d[0] == cur} onclick={() => pickDesign(d[0])} aria-pressed={appState.cd == d[0]}><span class="cdm">{@html CDB[d[0] as keyof typeof CDB]()}{#if l}<i class="lkb"><Lock /></i>{/if}</span><span class="cdl">{tr(d[1])}</span></button>{/each}</div>
    </Panel>
    <p class="eyebrow">{t("stReveal")}</p>
    <Panel class="pad">
      <p class="sub">{t("stAnim")}</p>
      <div class="rvp"><div class="rvc" id="rvc"></div></div>
      <Chips items={rvItems} active={appState.rv || "flip"} onpick={pickRevealAnim} />
      <div class="dv"></div>
      <div class="grp" class:off={!appState.snd} id="rsg"><p class="sub">{t("stSound")}</p><p class="rdesc" id="rsd">{rsTxt()}</p><Chips items={rsItems} active={appState.rs || "soapta"} onpick={pickRevealSound} disabled={!appState.snd} /></div>
      <div class="dv"></div>
      <div class="grp" class:off={!appState.vb} id="rbg"><p class="sub">{t("stBuzz")}</p><p class="rdesc" id="rbd">{rbTxt()}</p><Chips items={rbItems} active={appState.rb || "tick"} onpick={pickRevealBuzz} disabled={!appState.vb} /></div>
    </Panel>
    <p class="eyebrow">{t("stTimer")}</p>
    <Panel class="pad"><div class="grp" class:off={!appState.snd} id="tkg"><p class="sub">{t("stTick")}</p><p class="rdesc" id="tkd">{tkTxt()}</p><Chips items={tkItems} active={appState.tk} onpick={pickTick} disabled={!appState.snd} /></div></Panel>
    <p class="eyebrow">{t("stPerf")}</p>
    <Panel>
      <SwitchRow icon="bolt" title={t("stLite")} desc={t("stLiteDesc")} checked={appState.lite} onchange={() => toggleOption("lite")} />
      <SwitchRow icon="sleuth" title={t("stRelax")} desc={t("stRelaxDesc")} checked={appState.rx} onchange={() => toggleOption("rx")} />
    </Panel>
  </div>
  <button class="link full" onclick={showIntro}>{t("stIntro")}</button>
  <button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
