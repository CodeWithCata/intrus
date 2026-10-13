<!-- Mounts the sheet component named by state.sheet (map typed Record<SheetName, Component>). -->
<script lang="ts">
  /**
   * The open bottom sheet, driven by `appState.sheet`. Each sheet component wraps itself in Sheet.svelte
   * (scrim, dialog, focus, exit transition). Closing keeps the component mounted with `open` false
   * until Sheet reports the exit transition is over; switching straight to another sheet replaces it.
   */
  import { setContext, type Component } from "svelte";
  import { smil } from "#lib/utils/smil.ts";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { type SheetName } from "#lib/components/ui/sheets.ts";
  import HelpSheet from "#lib/components/sheets/HelpSheet.svelte";
  import SetSheet from "#lib/components/sheets/SetSheet.svelte";
  import PlayersSheet from "#lib/components/sheets/PlayersSheet.svelte";
  import AvatarSheet from "#lib/components/sheets/AvatarSheet.svelte";
  import CatsSheet from "#lib/components/sheets/CatsSheet.svelte";
  import RulesSheet from "#lib/components/sheets/RulesSheet.svelte";
  import OnlineSheet from "#lib/components/sheets/OnlineSheet.svelte";
  import GroupsSheet from "#lib/components/sheets/GroupsSheet.svelte";
  import GstatsSheet from "#lib/components/sheets/GstatsSheet.svelte";
  import GnameSheet from "#lib/components/sheets/GnameSheet.svelte";
  import LnameSheet from "#lib/components/sheets/LnameSheet.svelte";
  import LshareSheet from "#lib/components/sheets/LshareSheet.svelte";
  import LimportSheet from "#lib/components/sheets/LimportSheet.svelte";
  import AskSheet from "#lib/components/sheets/AskSheet.svelte";

  const sheets: Record<SheetName, Component<any, any, any>> = {
    help: HelpSheet,
    set: SetSheet,
    players: PlayersSheet,
    avatar: AvatarSheet,
    cats: CatsSheet,
    rules: RulesSheet,
    online: OnlineSheet,
    groups: GroupsSheet,
    gstats: GstatsSheet,
    gname: GnameSheet,
    lname: LnameSheet,
    lshare: LshareSheet,
    limport: LimportSheet,
    ask: AskSheet
  };

  // The last sheet that was open: it stays mounted (open = false) while its exit transition plays.
  let last = $state<SheetName | null>(null);
  const shown = $derived(appState.sheet ?? last);
  const Body = $derived(shown ? sheets[shown] : null);

  $effect(() => {
    if (appState.sheet) {
      last = appState.sheet;
    }
  });

  setContext("sheet-gone", () => {
    if (!appState.sheet) {
      last = null;
    }
  });

  // Pausing the background scene restyles every animated element and re-rasterises the page behind the sheet, which shows as a
  // one-frame flash on phones (seen ~250 ms after opening). So it is done on desktop only; on touch devices the scene keeps
  // running behind the dim layer (it only animates transform / opacity, which the GPU handles).
  const touch = matchMedia("(hover:none),(pointer:coarse),(max-width:820px)").matches;
  $effect(() => {
    const root = document.documentElement;
    if (touch || shown === null) {
      root.classList.remove("sheetopen");
      return;
    }
    const t = setTimeout(() => root.classList.add("sheetopen"), 280);
    return () => clearTimeout(t);
  });

  // The animated (SMIL) icons of the page behind run on the main thread and repaint on every frame, and with a sheet over them the
  // browser also has to redo the blurred dim layer each time. Pausing their clock changes no style and no layer, so, unlike the CSS
  // pause above, it is safe on phones too (no flash). It starts once the sheet has settled and ends when the exit transition is over.
  const isOpen = $derived(shown !== null);
  $effect(() => {
    const app = document.getElementById("app");
    if (!isOpen || !app) {
      return;
    }
    const t = setTimeout(() => smil(app, true), 300);
    return () => {
      clearTimeout(t);
      smil(app, false);
    };
  });
</script>

{#if Body}
  {#key shown}
    <Body open={appState.sheet !== null} />
  {/key}
{/if}
