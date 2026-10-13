<!-- Online sheet: create room, join by code, lobby. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import QrCode from "#lib/components/online/QrCode.svelte";
  import Segmented from "#lib/components/ui/Segmented.svelte";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { closeSheet } from "#lib/components/ui/sheets.ts";
  import { popEl } from "#lib/animations/motion.ts";
  import { openAvatarBuilder } from "#lib/stores/avatar-edit.svelte.ts";
  import { ask } from "#lib/stores/ask.svelte.ts";
  import { copyRoomLink, setOnlineMode, typeRoomCode } from "#lib/components/online/online.ts";
  import { online, onlineAvailable, inRoom, isHost, canStart, ignoredNow, startOnlineRound, createRoom, joinRoom, leaveRoom, roomLink, savedName } from "#lib/online/client.svelte.ts";
  import { languageOptions, locale, setLang, t, type Lang } from "#lib/i18n/index.svelte.ts";

  let { open }: { open: boolean } = $props();

  const modes = $derived([[0, t("olModeCreate")], [1, t("olModeJoin")]] as const);
  let name = $state(savedName());
  let copied = $state(false);
  const players = $derived(online.state?.players ?? []);
  const hostId = $derived(online.state?.hostId ?? null);
  const status = $derived(online.status === "connecting" ? t("mpConnecting") : online.status === "reconnecting" ? t("mpReconnecting") : "");
  const ignored = $derived(ignoredNow().map((k) => t(k).toLowerCase()).join(", "));

  function confirmLeave() {
    ask(t("mpLeave") + "?", t("olLeaveAsk"), t("quit"), leaveRoom);
  }

  // Enter in the name or code field does what the main button does (create, or join once the code is complete).
  function submit() {
    if (online.status === "connecting") {
      return;
    }
    if (!appState.ol) {
      createRoom(name);
    }
    else if (appState.code.length === 6) {
      joinRoom(appState.code, name);
    }
  }

  function onenter(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }
</script>

<Sheet {open} title={t("mpOpen")} onclose={closeSheet} name="online">
  {#snippet head()}<p class="muted small">{t("olSubtitle")}</p>{/snippet}
<div class="stack">
  {#if languageOptions().length > 1}<Segmented two options={languageOptions()} value={locale.lang} onpick={(l: Lang) => setLang(l)} />{/if}
  {#if !onlineAvailable}
    <Panel class="pad"><p class="muted">{t("olUnavailable")}</p></Panel>
  {:else if inRoom()}
    {#if status}<p class="kcap small muted" role="status">{status}</p>{/if}
    {#if online.error}<p class="kcap small" role="alert">{t(online.error)}</p>{/if}
    <p class="eyebrow first">{t("mpRoomCode")}</p>
    <Panel class="pad codebox"><div class="cl"><p class="cap">{t("olCodeCap")}</p><p class="code lobbycode" aria-label={online.code.split("").join(" ")}>{online.code}</p><button class="btn" onclick={async (e) => { popEl(e.currentTarget); copied = await copyRoomLink(); }}>{copied ? t("olLinkCopied") : t("olCopyLink")}</button></div><div class="qrw">{#if online.code}<QrCode text={roomLink()} />{/if}<p class="small muted">{t("olScanHint")}</p></div></Panel>
    <p class="eyebrow">{t("olInRoom", { n: players.length })}</p>
    <Panel>{#each players as p (p.id)}<div class="cr">{#if p.id === online.playerId}<button class="avbtn" aria-label={t("olAvatarChange")} onclick={() => openAvatarBuilder(0, "online")}><Avatar player={{ a: 0, l: p.l }} size={48} /></button>{:else}<span class="avbtn" class:gone={!p.connected}><Avatar player={{ a: 0, l: p.l }} size={48} /></span>{/if}<div class="rt"><p class="rname">{p.name}{p.id === online.playerId ? " " + t("olYou") : ""}</p></div><span class="bdg" class:o={p.id !== hostId}>{p.id === hostId ? t("olHost") : p.connected ? t("olConnected") : t("olDisconnected")}</span></div>{/each}</Panel>
    {#if isHost()}
      <button class="btn go full" disabled={!canStart()} onclick={startOnlineRound}>{t("olStartRound")}</button>
      <p class="kcap small muted">{t("olNeedPlayers")}</p>
      {#if ignored}<p class="kcap small muted" role="note">{t("olIgnored", { list: ignored })}</p>{/if}
    {:else}
      <p class="kcap small muted">{t("olWaitingHost")}</p>
    {/if}
    <button class="link" onclick={confirmLeave}>{t("mpLeave")}</button>
  {:else}
    <Segmented two options={modes} value={appState.ol} onpick={(i) => setOnlineMode(i)} />
    <p class="eyebrow first">{t("mpYourName")}</p>
    <div class="cr me"><button class="avbtn" aria-label={t("olAvatarChange")} onclick={() => openAvatarBuilder(0, "online")}><Avatar player={appState.players[0] ?? 0} size={52} /></button><input class="custom" type="text" maxlength="24" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" onkeydown={onenter} placeholder={t("olNamePh")} bind:value={name} aria-label={t("mpYourName")} /></div>
    {#if online.error}<p class="kcap small" role="alert">{t(online.error)}</p>{/if}
    {#if appState.ol}
      <p class="eyebrow">{t("olCodeLabel")}</p>
      <input class="custom codein" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" onkeydown={onenter} placeholder="ABC123" value={appState.code} oninput={(e) => typeRoomCode(e.currentTarget)} aria-label={t("olCodeLabel")} />
      <p class="kcap small muted">{t("olCodeHelp")}</p>
      <button class="btn go full" disabled={appState.code.length !== 6 || online.status === "connecting"} onclick={() => joinRoom(appState.code, name)}>{t("olJoinBtn")}</button>
    {:else}
      <p class="kcap small muted">{t("olCreateHint")}</p>
      <button class="btn go full" disabled={online.status === "connecting"} onclick={() => createRoom(name)}>{t("olCreateBtn")}</button>
    {/if}
  {/if}
</div>
<button class="btn go" onclick={closeSheet}>{t("olDone")}</button>
</Sheet>

<style>
  .avbtn{display:inline-flex;flex:none;background:none;border:0;padding:0;margin-right:var(--s2);cursor:pointer;transition:opacity var(--ease),filter var(--ease)}
  .avbtn.gone{opacity:.4;filter:grayscale(1)}
  :global(.codebox .code.lobbycode){font-size:clamp(34px,11vw,48px);letter-spacing:.14em}
</style>
