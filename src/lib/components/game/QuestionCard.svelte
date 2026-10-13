<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Question-mode card. Everything shown comes from the reactive `questionState`
   * (game/questions.svelte.ts); the only imperative bit is restarting the "qin" entrance
   * animation on the question text whenever a new question is drawn.
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { playerName } from "#lib/stores/players.svelte.ts";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { questionState, nextQuestion, redoQuestion } from "#lib/game/questions.svelte.ts";

  let line = $state<HTMLElement>();

  $effect(() => {
    const q = questionState.q;
    if (!line || !q) {
      return;
    }
    line.classList.remove("qin");
    void line.offsetWidth;
    line.classList.add("qin");
  });
</script>

<div class="panel qc"
  ><div class="cr"><span class="ri" id="qav"><Avatar player={appState.players[questionState.i]} size={36} /></span><div class="rt"><p class="rname" id="qa">{t("rdAsks", { name: playerName(questionState.i) })}</p><p class="qt" id="qt" aria-live="polite" bind:this={line}>{questionState.q}</p><p class="rdesc">{t("rdAnswerNote")}</p></div></div
  ><div class="acts"><button class="btn" onclick={redoQuestion}><Icon name="redo" />{t("rdOtherQ")}</button><button class="btn" onclick={nextQuestion}><Icon name="chev" />{t("rdNext")}</button></div></div
>
