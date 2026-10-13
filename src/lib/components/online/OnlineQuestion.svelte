<!-- Shared question card in the online discussion. -->
<script lang="ts">
  /**
   * Online question mode. The same card as the local game (QuestionCard), but who asks and the question come from the server, so every
   * phone shows the same one. Only the host or the player asking may draw the next question.
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import { beep } from "#lib/audio/tone.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const q = $derived(online.state?.question ?? null);
  const asker = $derived(q ? online.state?.players.find((p) => p.id === q.askerId) : undefined);
  const mayDraw = $derived(isHost() || (!!q && q.askerId === online.playerId));

  let line = $state<HTMLElement>();

  // Restarts the entrance animation of the text whenever a new question arrives.
  $effect(() => {
    const text = q?.q;
    if (!line || !text) return;
    line.classList.remove("qin");
    void line.offsetWidth;
    line.classList.add("qin");
  });

  function draw(action: "next" | "other") {
    send({ type: "question", action, n: q?.n });
    beep(action === "next" ? 600 : 520, 0.05);
    vibrate(10);
  }
</script>

{#if q && asker}
  <div class="panel qc"
    ><div class="cr"><span class="ri" id="qav"><Avatar player={{ a: 0, l: asker.l }} size={36} /></span><div class="rt"><p class="rname" id="qa">{t("rdAsks", { name: asker.name })}</p><p class="qt" id="qt" aria-live="polite" bind:this={line}>{q.q}</p><p class="rdesc">{t("rdAnswerNote")}</p></div></div
    >{#if mayDraw}<div class="acts"><button class="btn" onclick={() => draw("other")}><Icon name="redo" />{t("rdOtherQ")}</button><button class="btn" onclick={() => draw("next")}><Icon name="chev" />{t("rdNext")}</button></div>{/if}</div
  >
{/if}
