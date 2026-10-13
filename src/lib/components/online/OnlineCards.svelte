<!-- Online round step: everyone looks at their own card. -->
<script lang="ts">
  /**
   * Online: the secret card. The SAME Card as the local game (hold to flip, your card design, reveal style, sounds, peek protection).
   * The role comes privately from the server; the first time the card opens the server is told ("seen"), so the host can see who is ready.
   */
  import Avatar from "#lib/components/players/Avatar.svelte";
  import Card from "#lib/components/game/Card.svelte";
  import StatusRow from "#lib/components/online/StatusRow.svelte";
  import { online, isHost, send } from "#lib/online/client.svelte.ts";
  import type { Role } from "#lib/online/protocol.ts";
  import type { Player } from "#lib/game/types.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  const st = $derived(online.state);
  const players = $derived(st?.players ?? []);
  const me = $derived(players.find((p) => p.id === online.playerId));
  const seen = $derived(st?.seen ?? []);
  /** Only the players dealt into the round count (someone who was away at the deal, or came back later, just watches). */
  const dealt = $derived(st?.dealt ?? null);
  const inRound = $derived(dealt ? players.filter((p) => dealt.includes(p.id)) : players);
  const here = $derived(inRound.filter((p) => p.connected));
  const iSaw = $derived(!!online.playerId && seen.includes(online.playerId));
  const role = $derived(online.role);

  function hintLine(r: Role): string {
    if (!r.isIntruder) return "";
    if (r.hint !== "none" && r.customHint) return t("hnHint", { h: r.customHint }); // the hint the host wrote for this custom word
    if (r.hint === "category") return r.category ? t("categoryIs", { c: r.category }) : "";
    if (r.hint === "related") return r.decoy ? t("relatedIs", { w: r.decoy }) : "";
    if (r.hint === "letter") return r.letter ? t("letterIs", { l: r.letter }) : "";
    return t("noHint");
  }

  /** "Intruders who know each other": the other intruders, shown on the face of an intruder's card. */
  const mates = $derived(
    (role?.mates ?? []).flatMap((id) => {
      const m = players.find((p) => p.id === id);
      return m ? [{ p: { n: m.name, a: 0, l: m.l } as Player, name: m.name }] : [];
    })
  );

  let told = false;
  function onreveal() {
    if (told) return;
    told = send({ type: "seen" }); // a tap lost while the connection is down is tried again on the next hold
  }
</script>

{#if role}
  <div class="who">{#if me}<Avatar player={{ a: 0, l: me.l }} size={56} />{/if}<div><h1 class="h1">{me?.name ?? ""}</h1><p class="muted">{t("rdHold")}</p></div></div>
  <Card intruder={role.isIntruder} secret={role.word ?? ""} hint={hintLine(role)} {mates} {onreveal} />
{:else}
  <div class="who"><div><h1 class="h1">{t("roundN", { n: st?.round ?? 1 })}</h1><p class="muted">{t("olSpectator")}</p></div></div>
  <div class="grow"></div>
{/if}
<footer class="dock">
  <StatusRow players={inRound} done={seen} />
  <p class="note small muted" role="status">{t("olSeenCount", { n: seen.length, total: here.length })}</p>
  {#if isHost()}
    <button class="btn go" disabled={!!role && !iSaw} onclick={() => send({ type: "talk-start" })}>{t("rdStartTalk")}</button>
  {:else}
    <p class="note small muted">{t("olWaitingStart")}</p>
  {/if}
</footer>
