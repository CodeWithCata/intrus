<!-- Discussion screen with the timer ring. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Discussion screen. The countdown (TimerRing, TalkControls) and the question card bind to
   * reactive stores; views/talk.ts only starts them.
   * Markup and class names are identical to the former HTML-string template.
   */
  import QuitBar from "#lib/components/layout/QuitBar.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import VoiceButton from "#lib/components/game/VoiceButton.svelte";
  import TwistCard from "#lib/components/game/TwistCard.svelte";
  import QuestionCard from "#lib/components/game/QuestionCard.svelte";
  import TimerRing from "#lib/components/game/TimerRing.svelte";
  import TalkControls from "#lib/components/game/TalkControls.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { round } from "#lib/stores/ui.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import { VOICE_SUPPORTED } from "#lib/voice/host.ts";
  import { go } from "#lib/stores/nav.svelte.ts";
  import FirstWheel from "#lib/components/game/FirstWheel.svelte";
  import TalkDim from "#lib/components/game/TalkDim.svelte";
  import { speakTalkIntro } from "#lib/game/questions.svelte.ts";

  let { wheel = false }: { resume?: boolean; wheel?: boolean } = $props();

  /** The opening wheel is spinning: the line below stays hidden (its place is kept) until the wheel has stopped on `round.first`. */
  let spinning = $state(untrack(() => wheel));
  function landed() {
    spinning = false;
    speakTalkIntro();
  }
</script>

{#if appState.tm}<TalkDim />{/if}
<section class="screen center"
  ><QuitBar />
  <div><h1 class="h1">{t("rdDiscussion")}</h1><p class="muted">{appState.qm ? t("rdTalkQ") : t("rdTalkW")}</p></div>
  {#if spinning}<FirstWheel first={round.first} ondone={landed} />{/if}
  <p class="starter" style:visibility={spinning ? "hidden" : null}><Avatar player={appState.players[round.first]} size={32} />{t("rdStarts", { name: playerName(round.first) })}</p>
  {#if appState.vh && VOICE_SUPPORTED}<VoiceButton />{/if}<TwistCard tw={round.tw} />{#if appState.qm}<QuestionCard />{/if}
  <div class="grow"></div>
  {#if appState.tm}<TimerRing />{/if}
  <div class="grow"></div>{#if appState.tm}<TalkControls />{/if}
  <footer class="dock"><button class="btn go" onclick={() => go("vote", { i: 0 })}>{t("rdToVote")}</button><button class="link" onclick={() => go("reveal")}>{t("rdSkipVote")}</button></footer></section
>
