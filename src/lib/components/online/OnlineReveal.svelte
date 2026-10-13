<!-- Online round step: reveal of the word and the intruders. -->
<script lang="ts">
  /**
   * Online: who the intruders were. The server only sent them (and the word) because the host revealed. Same stage as the local reveal:
   * cone, large avatars, the INTRUS stamp, the staged build-up (RevealDrama) and the verdict of the vote; the host then picks how the round ended.
   */
  import { onMount, untrack } from "svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import RevealDrama from "#lib/components/game/RevealDrama.svelte";
  import TwistNote from "#lib/components/game/TwistNote.svelte";
  import { CONE } from "#lib/components/game/art.ts";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { planReveal } from "#lib/game/drama.ts";
  import { screenShake } from "#lib/animations/motion.ts";
  import { SFX } from "#lib/audio/sfx.ts";
  import { vibrate } from "#lib/audio/haptics.ts";
  import { isCalm } from "#lib/utils/calm.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const st = $derived(online.state);
  const players = $derived(st?.players ?? []);
  const reveal = $derived(st?.reveal ?? null);
  const intruders = $derived(reveal ? reveal.intruderIds.map((id) => players.find((p) => p.id === id)).filter((p) => !!p) : []);
  const vote = $derived(st?.vote ?? null);
  const top = $derived.by(() => {
    if (!vote || !vote.revealed) return [] as string[];
    const max = Math.max(0, ...Object.values(vote.tally));
    return max > 0 ? Object.keys(vote.tally).filter((id) => vote.tally[id] === max) : [];
  });
  const caught = $derived(top.length === 1 && !!reveal && reveal.intruderIds.includes(top[0]));
  const rec = $derived(top.length ? (caught ? 0 : 2) : -1);
  const dramaPlayers = $derived(players.map((p) => ({ a: 0, l: p.l, name: p.name })));
  /** "Double or nothing" doubles every award (the server does the same when it scores the round). */
  const mult = $derived(reveal?.twist === "dbl" ? 2 : 1);
  /** TwistNote reads the shape of the local round; this is the same note, filled from the reveal. */
  const note = $derived({ troll: false, tw: reveal?.twist ?? null, da: reveal?.agentId ?? null, word2: reveal?.word2 ?? "", intr: reveal?.intruderIds ?? [] });
  const agentName = $derived(players.find((p) => p.id === reveal?.agentId)?.name ?? "");

  // Planned once, when the reveal appears: the build-up only decorates, the real result is already on the page underneath.
  const plan = untrack(() => planReveal({ calm: isCalm(), troll: false, n: players.length, intr: reveal ? reveal.intruderIds.map((id) => players.findIndex((p) => p.id === id)) : [], drama: appState.dr }));
  const staged = plan.steps.length > 1;

  onMount(() => {
    if (!staged) {
      setTimeout(screenShake, 330);
      SFX.intrus();
      vibrate([80, 60, 80]);
    }
  });

  const outcomes = $derived<[string, string][]>([
    [t("rdOutCaught"), t("rdPtsOthers", { n: mult })],
    [t("rdOutGuess"), t("rdPtsIntr", { n: mult })],
    [t("rdOutEscaped"), t("rdPtsIntr", { n: 2 * mult })]
  ]);
  const kinds = ["caught", "guessed", "escaped"] as const;

  let escaped = $state<string[]>([]);
  const toggle = (id: string) => (escaped = escaped.includes(id) ? escaped.filter((x) => x !== id) : [...escaped, id]);
  function outcome(k: number) {
    send({ type: "outcome", kind: kinds[k], escapedIds: kinds[k] === "escaped" && intruders.length > 1 ? escaped : undefined });
    escaped = [];
  }
</script>

{#if reveal}
  <div class="dwrap"><p class="muted" role="heading" aria-level="1">{t(intruders.length > 1 ? "rdIntrWere" : "rdIntrWas")}</p>
    <!-- {@html} below: constant CONE artwork from game/art.ts, never user text -->
    <div class="stage">{@html CONE}{#each intruders as p (p.id)}<div><Avatar player={{ a: 0, l: p.l }} size={96} /><p class="h2">{p.name}</p></div>{/each}</div>
    <span class="stamp red">{t("stStamp")}</span>{#if staged}<RevealDrama {plan} players={dramaPlayers} />{/if}</div>
  <div><p class="muted">{t("rdWordWas")}</p><p class="wordtag">{reveal.word}</p>{#if reveal.twin}<p class="muted">{t(intruders.length > 1 ? "rdIntrHadMany" : "rdIntrHadOne", { w: reveal.twin })}</p>{/if}</div>
  {#if reveal.twist}<TwistNote round={note} agent={agentName} base={reveal.baseIntruders} />{/if}
  {#if top.length}<p class="verdict">{caught ? t("rdCaught") : t("rdWrong")}</p>{/if}
{/if}
<div class="grow"></div>
<footer class="dock">
  {#if isHost()}
    <p class="h2">{t("rdHow")}</p>
    {#if intruders.length > 1}
      <p class="muted small">{t("partialTitle")}</p>
      <div class="vgrid">{#each intruders as p (p.id)}<button class="suspect" aria-pressed={escaped.includes(p.id)} onclick={() => toggle(p.id)}><Avatar player={{ a: 0, l: p.l }} size={32} /> {p.name}</button>{/each}</div>
    {/if}
    {#if reveal?.twin}<p class="muted small">{t("twNoGuess")}</p>{/if}
    {#each outcomes as [label, points], k (label)}{#if !(reveal?.twin && k === 1)}<button class="outcome{k === rec ? " rec" : ""}" onclick={() => outcome(k)}><span>{label}</span><span class="pts">{points}</span></button>{/if}{/each}
  {:else}
    <p class="note small muted">{t("olWaitingOutcome")}</p>
  {/if}
</footer>
