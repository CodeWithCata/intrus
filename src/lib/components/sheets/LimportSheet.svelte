<!-- Import a shared word list (file or pasted text) with a confirm step. -->
<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /**
   * Import a custom list: paste a link / code, choose a file, or arrive from a link. Whatever comes in is shown here first (as
   * plain text) and added ONLY when the player taps "Adaugă lista": nothing is imported automatically.
   */
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Segmented from "#lib/components/ui/Segmented.svelte";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { share, clashes, confirmImport, cancelImport, importFile, importPasted } from "#lib/stores/list-share.svelte.ts";

  let { open }: { open: boolean } = $props();

  const p = $derived(share.pending);
  const clash = $derived(p ? clashes(p.list.name) : false);
  const options = $derived([["both", t("liKeepBoth")], ["replace", t("liReplace")]] as const);
</script>

<Sheet {open} title={p ? t("liAddQ") : t("liImport")} onclose={p ? cancelImport : closeSheet} name="limport">
  {#snippet head()}<p class="muted small">{p ? t("liCheck") : t("liFrom")}</p>{/snippet}
  {#if p}
    <Panel class="pad">
      <p class="rname">{p.list.name}</p>
      <p class="rdesc">{t(p.list.words.length == 1 ? "catWordOne" : "catWords", { n: p.list.words.length })}{p.dropped ? " · " + t("liDropped", { n: p.dropped }) : ""}</p>
      <!-- the words are plain text from a stranger: Svelte renders them as text, never as HTML -->
      <p class="small impw">{p.list.words.slice(0, 14).join(", ")}{p.list.words.length > 14 ? "…" : ""}</p>
    </Panel>
    {#if clash}
      <Panel class="pad"><p class="rname">{t("liClash")}</p><Segmented pop options={options} value={share.onClash} onpick={(v) => (share.onClash = v)} /></Panel>
    {/if}
    <button class="btn go" onclick={confirmImport}><Icon name="plus" />{t("liAdd")}</button>
    <button class="link full" onclick={cancelImport}>{t("liCancel")}</button>
  {:else}
    <Panel class="pad">
      <input class="custom" type="text" inputmode="url" placeholder={t("liPaste")} bind:value={share.paste} aria-label={t("liPasteAria")} maxlength="12400" />
      <button class="btn go" onclick={importPasted} disabled={!share.paste.trim()}>{t("liContinue")}</button>
    </Panel>
    <Panel class="pad">
      <label class="btn filebtn"><Icon name="folder" />{t("liPick")}<input type="file" accept=".json,application/json" onchange={(e) => importFile(e.currentTarget.files?.[0])} /></label>
    </Panel>
    <button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
  {/if}
</Sheet>
