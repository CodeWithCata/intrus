<!-- Online round container: picks the online step to show from the server phase. -->
<script lang="ts">
  /**
   * The round of an online game, one phone per player. Everything shown comes from the server (online/client.svelte.ts), and every stage
   * is built from the same pieces as the local game (see components/online/): the secret card, the shared wheel and timer, the vote,
   * the reveal and the scoreboard. Order of the stages: reveal (or the troll surprise) > vote > discussion > card.
   */
  import Icon from "#lib/components/ui/Icon.svelte";
  import OnlineCards from "#lib/components/online/OnlineCards.svelte";
  import OnlineTalk from "#lib/components/online/OnlineTalk.svelte";
  import OnlineVote from "#lib/components/online/OnlineVote.svelte";
  import OnlineTally from "#lib/components/online/OnlineTally.svelte";
  import OnlineReveal from "#lib/components/online/OnlineReveal.svelte";
  import OnlineTroll from "#lib/components/online/OnlineTroll.svelte";
  import OnlineScores from "#lib/components/online/OnlineScores.svelte";
  import { ask } from "#lib/stores/ask.svelte.ts";
  import { online, leaveRoom } from "#lib/online/client.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const st = $derived(online.state);
  const stage = $derived.by(() => {
    if (!st || st.phase === "scores") return "scores";
    if (st.reveal) return st.reveal.troll ? "troll" : "reveal";
    if (st.vote) return st.vote.revealed ? "tally" : "vote";
    if (st.talk) return "talk";
    return "cards";
  });

  function confirmLeave() {
    ask(t("mpLeave") + "?", t("olLeaveAsk"), t("quit"), leaveRoom);
  }
</script>

<section class="screen" class:center={stage === "talk" || stage === "reveal" || stage === "troll" || stage === "scores"}
  ><header><div class="bar"><button class="round" onclick={confirmLeave} aria-label={t("mpLeave")}><Icon name="x" /></button><p class="muted small">{t("olRoom", { code: online.code })}{online.status === "reconnecting" ? " · " + t("mpReconnecting") : ""}</p><span class="sp"></span></div></header>
  {#if online.error}<p class="small" role="alert">{t(online.error)}</p>{/if}
  {#if stage === "cards"}<OnlineCards />
  {:else if stage === "talk"}<OnlineTalk />
  {:else if stage === "vote"}<OnlineVote />
  {:else if stage === "tally"}<OnlineTally />
  {:else if stage === "reveal"}<OnlineReveal />
  {:else if stage === "troll"}<OnlineTroll />
  {:else}<OnlineScores />{/if}</section
>
