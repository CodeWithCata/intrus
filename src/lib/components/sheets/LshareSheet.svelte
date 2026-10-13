<!-- Share a word list (link / text). -->
<script lang="ts">
  /** Export one custom list: link, QR code (made on this device, only loaded when it is opened) or file. */
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { share, qrFits, sendLink, copyLink, sendFile } from "#lib/stores/list-share.svelte.ts";
  import { t } from "#lib/i18n/index.svelte.ts";

  let { open }: { open: boolean } = $props();

  const fits = $derived(qrFits(share.link));
  const n = $derived(share.list?.words.length ?? 0);
</script>

<Sheet {open} title={t("lsTitle")} onclose={closeSheet} name="lshare">
  {#snippet head()}<p class="muted small">{share.list?.name} · {t(n == 1 ? "catWordOne" : "catWords", { n })}</p>{/snippet}
  <div class="stack">
    <Panel class="pad">
      <p class="rname">{t("lsLink")}</p>
      <p class="rdesc">{t("lsLinkDesc")}</p>
      <div class="acts"><button class="btn go" onclick={sendLink}><Icon name="saved" />{t("lsSendLink")}</button><button class="btn" onclick={copyLink}>{t("lsCopy")}</button></div>
    </Panel>
    <Panel class="pad">
      <p class="rname">{t("lsQr")}</p>
      {#if fits}
        {#await import("#lib/components/online/QrCode.svelte") then m}<div class="qrbox"><m.default text={share.link} /></div>{/await}
        <p class="rdesc">{t("lsQrDesc")}</p>
      {:else}
        <p class="rdesc">{t("lsQrBig")}</p>
      {/if}
    </Panel>
    <Panel class="pad">
      <p class="rname">{t("lsFile")}</p>
      <p class="rdesc">{t("lsFileDesc")}</p>
      <button class="btn" onclick={sendFile}><Icon name="folder" />{t("lsSendFile")}</button>
    </Panel>
  </div>
  <button class="btn go" onclick={closeSheet}>{t("csDone")}</button>
</Sheet>
