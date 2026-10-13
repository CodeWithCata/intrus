<!-- Players sheet: list, add, remove with undo, drag to reorder, name suggestions. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { rowIn, rowOut } from "#lib/components/players/row-motion.ts";
  import { rowDrag } from "#lib/components/players/row-drag.ts";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { openAvatarBuilder } from "#lib/stores/avatar-edit.svelte.ts";
  import { MAX_PLAYERS, addPlayer, movePlayer, nextPlayer, playerName, removePlayer, removePlayerPhoto } from "#lib/stores/players.svelte.ts";
  import { nameSuggestions } from "#lib/components/players/name-suggestions.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import { tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  let { open }: { open: boolean } = $props();

  const n = $derived(appState.players.length);
  const sugg = $derived(n < MAX_PLAYERS ? nameSuggestions() : []);
  // The optional title is hidden until the pencil is tapped (rows that already have one start expanded).
  const shown = new SvelteSet<object>(appState.players.filter(p => p.ti));

  async function editTitle(p: object, i: number) {
    shown.add(p);
    await tick();
    document.querySelector<HTMLInputElement>('#sr .ttlin[data-ti="' + i + '"]')?.focus();
  }

  // Order = the order the phone is passed in. Dragging a row (row-drag.ts) and the grip's arrow keys both end here.
  let moveNote = $state("");

  async function reorder(from: number, to: number, kbd: boolean) {
    if (!movePlayer(from, to)) {
      return;
    }
    moveNote = t("plMoved", { name: playerName(to), n: to + 1 });
    if (kbd) {
      // The row's DOM node moved, so give the keyboard focus back to its grip.
      await tick();
      document.querySelector<HTMLElement>('#sr .grip[data-gi="' + to + '"]')?.focus();
    }
  }
</script>

<Sheet {open} title={t("suPlayers")} onclose={closeSheet} name="players">
  {#snippet head()}<p class="muted small">{t("plCount", { n })}</p>{/snippet}
<div class="plscroll">
<Panel class="pl">
  {#each appState.players as p, i (p)}
    <div class="cr" in:rowIn out:rowOut
      ><button class="grip" data-gi={i} use:rowDrag={{ index: i, count: n, onmove: reorder }} aria-label={t("plMoveAria", { n: i + 1 })}></button><span class="pw"
        ><button class="pick" onclick={() => openAvatarBuilder(i)} aria-label={t("plAvatarAria")}><Avatar player={p} size={48} /></button><button class="cam" onclick={() => openAvatarBuilder(i)} aria-label={t("plAvatarAria")}><Icon name="pencil" /></button
        >{#if p.ph}<button class="camx" onclick={() => removePlayerPhoto(i)} aria-label={t("plPhotoRemove")}><Icon name="x" /></button>{/if}</span
      ><input class="field" data-i={i} type="text" maxlength="14" enterkeyhint="next" autocomplete="off" placeholder={t("defPlayer", { n: i + 1 })} bind:value={p.n} onkeydown={(e) => nextPlayer(i, e)} aria-label={t("plNameAria", { n: i + 1 })} /><button class="pen" onclick={() => editTitle(p, i)} aria-expanded={shown.has(p)} aria-label={t("editTitle")}><Icon name="pencil" /></button
      >{#if n > 3}<button class="round" data-a="rm" onclick={() => removePlayer(i)} aria-label={t("plRemove")}><Icon name="x" /></button>{/if}{#if shown.has(p)}<input class="ttlin" data-ti={i} list="ttls" type="text" maxlength="24" enterkeyhint="next" placeholder={t("plTitleHint")} bind:value={p.ti} onkeydown={(e) => nextPlayer(i, e)} aria-label={t("plTitleAria", { n: i + 1 })} />{/if}</div
    >
  {/each}
</Panel>
</div>
<p class="sr-only" role="status">{moveNote}</p>
<div class="pdock">
  {#if sugg.length}<div class="nsug" role="group" aria-label={t("nameSuggestions")}>{#each sugg as nm (nm)}<button onclick={() => addPlayer({ name: nm })} aria-label={t("addNamed", { name: nm })}>+ {nm}</button>{/each}</div>{/if}
  {#if n < MAX_PLAYERS}<button class="addrow" onclick={() => addPlayer({ focus: true })}><span class="plus"><Icon name="plus" /></span>{t("addPlayer")}</button>{/if}
  <p class="muted small pcap">{t("plTap")}</p>
</div>
<button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
