<script lang="ts">
  /** "New version" pill under the status bar, with an Update button. Only shown while the player is at rest (never mid-round, never in an online room). */
  import { update } from "#lib/stores/update.svelte.ts";
  import { applyUpdate } from "#lib/utils/sw-update.ts";
  import { nav } from "#lib/stores/nav.svelte.ts";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { inRoom } from "#lib/online/client.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";
  import Icon from "#lib/components/ui/Icon.svelte";

  const show = $derived(update.ready && nav.screen === "setup" && !state.sheet && !inRoom());

  function go() {
    if (update.busy) {
      return;
    }
    update.busy = true;
    if (!applyUpdate()) {
      location.reload();
    }
  }
</script>

{#if show}
  <div id="upd" role="status" aria-live="polite">
    <span class="uic"><Icon name="redo" /></span>
    <span class="umsg">{t("updateReady")}</span>
    <button class="ubtn" onclick={go} disabled={update.busy}>{update.busy ? "…" : t("updateNow")}</button>
  </div>
{/if}
