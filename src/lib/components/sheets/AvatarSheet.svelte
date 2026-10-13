<!-- Avatar builder sheet: quick styles, four pages of part chips, dice, photo. -->
<script lang="ts">
  import Sheet from "#lib/components/ui/Sheet.svelte";
  import Panel from "#lib/components/ui/Panel.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Avatar from "#lib/components/players/Avatar.svelte";
  import { t, type MessageKey } from "#lib/i18n/index.svelte.ts";
  import { state as appState } from "#lib/stores/settings.svelte.ts";
  import { avatarEdit, closeAvatarBuilder } from "#lib/stores/avatar-edit.svelte.ts";
  import { choosePhoto, hasTwinLook, playerName, randomizeAvatar, removePlayerPhoto, setAvatarPart, setAvatarStyle } from "#lib/stores/players.svelte.ts";
  import {
    BROW_ORDER, FRAMES_COUNT, HAIR_COUNT, HAIR_TONE_COUNT, HAT_COUNT, MOUTH_COUNT, NO_HAT, OUTFIT_COUNT, SKIN_COUNT, STYLE_COUNT,
    applyStyle, hasStyle, lookToCode, playerLook, type AvatarLook, type BrowStyle
  } from "#lib/components/players/avatar-parts.ts";

  let { open }: { open: boolean } = $props();

  /** The player being edited (undefined if that player was removed meanwhile). */
  const p = $derived(appState.players[avatarEdit.i]);
  const look = $derived(p ? playerLook(p) : null);

  const BROW_KEYS: Record<BrowStyle, MessageKey> = { base: "avBrowBase", arched: "avBrowArched", thick: "avBrowThick", angry: "avBrowAngry", flat: "avBrowFlat" };
  const HAT_KEYS: MessageKey[] = ["avHat0", "avHat1", "avHat2", "avHat3", "avHat4", "avHat5", "avHat6"];
  const SKIN_KEYS: MessageKey[] = ["avSkin0", "avSkin1", "avSkin2"];
  const HAIR_KEYS: MessageKey[] = ["avHair0", "avHair1", "avHair2", "avHair3", "avHair4", "avHair5", "avHair6", "avHair7"];
  const HAIR_TONE_KEYS: MessageKey[] = ["avHairTone0", "avHairTone1", "avHairTone2"];
  const OUTFIT_KEYS: MessageKey[] = ["avOutfit0", "avOutfit1", "avOutfit2", "avOutfit3"];
  const FRAMES_KEYS: MessageKey[] = ["avFrames0", "avFrames1", "avFrames2", "avFrames3"];
  const MOUTH_KEYS: MessageKey[] = ["avMouth0", "avMouth1", "avMouth2", "avMouth3", "avMouth4"];
  const STYLE_KEYS: MessageKey[] = ["avStyle0", "avStyle1", "avStyle2", "avStyle3"];

  /** The builder's pages: face, hair (and hats), clothes, small details. */
  const TAB_FACE = 0, TAB_HAIR = 1, TAB_CLOTHES = 2, TAB_EXTRA = 3;
  let tab = $state(TAB_FACE);
  const tabs = $derived([[TAB_FACE, t("avTabFace")], [TAB_HAIR, t("avTabHair")], [TAB_CLOTHES, t("avTabOutfit")], [TAB_EXTRA, t("avTabExtra")]] as const);

  interface Choice {
    value: AvatarLook[keyof AvatarLook];
    label: MessageKey;
    /** The "nothing" choice (no hat, no glasses, no lashes, ...): its tile shows a prohibition sign instead of a face. */
    none?: boolean;
  }
  interface Part {
    key: keyof AvatarLook;
    title: MessageKey;
    tab: number;
    choices: Choice[];
    /** A row is hidden while its choices would not change the face (no glasses with a mustache, no hair colour without hair, ...). */
    show?: (look: AvatarLook) => boolean;
  }

  /** `none` is the index of the "nothing" choice, if the row has one (hair keeps a plain bald face, so it has none). */
  const range = (count: number, keys: MessageKey[], none?: number): Choice[] => Array.from({ length: count }, (_, v) => ({ value: v, label: keys[v], none: v === none }));
  /** A yes / no row: "off" is the nothing choice. */
  const toggle = (off: MessageKey, on: MessageKey): Choice[] => [{ value: false, label: off, none: true }, { value: true, label: on }];

  /** One row per part. Every choice is drawn as the current face with only that part changed. */
  const parts: Part[] = [
    { key: "skin", title: "avSkin", tab: TAB_FACE, choices: range(SKIN_COUNT, SKIN_KEYS) },
    { key: "mustache", title: "avFace", tab: TAB_FACE, choices: [{ value: false, label: "avGlasses" }, { value: true, label: "avMustache" }] },
    { key: "frames", title: "avFrames", tab: TAB_FACE, choices: range(FRAMES_COUNT, FRAMES_KEYS, 3), show: (l) => !l.mustache },
    { key: "mouth", title: "avMouth", tab: TAB_FACE, choices: range(MOUTH_COUNT, MOUTH_KEYS), show: (l) => !l.mustache },
    { key: "brows", title: "avBrows", tab: TAB_FACE, choices: BROW_ORDER.map((v) => ({ value: v, label: BROW_KEYS[v] })) },
    { key: "hat", title: "avHat", tab: TAB_HAIR, choices: range(HAT_COUNT, HAT_KEYS, NO_HAT) },
    { key: "hair", title: "avHair", tab: TAB_HAIR, choices: range(HAIR_COUNT, HAIR_KEYS) },
    { key: "hairTone", title: "avHairTone", tab: TAB_HAIR, choices: range(HAIR_TONE_COUNT, HAIR_TONE_KEYS), show: (l) => l.hair > 0 },
    { key: "beard", title: "avBeard", tab: TAB_HAIR, choices: toggle("avBeardOff", "avBeardOn") },
    { key: "outfit", title: "avOutfit", tab: TAB_CLOTHES, choices: range(OUTFIT_COUNT, OUTFIT_KEYS) },
    { key: "tie", title: "avTie", tab: TAB_CLOTHES, choices: toggle("avTieOff", "avTieOn"), show: (l) => l.outfit === 0 },
    { key: "lashes", title: "avLashes", tab: TAB_EXTRA, choices: toggle("avLashesOff", "avLashesOn") },
    { key: "lips", title: "avLips", tab: TAB_EXTRA, choices: toggle("avLipsOff", "avLipsOn"), show: (l) => !l.mustache },
    { key: "blush", title: "avBlush", tab: TAB_EXTRA, choices: toggle("avBlushOff", "avBlushOn") },
    { key: "freckles", title: "avFreckles", tab: TAB_EXTRA, choices: toggle("avFrecklesOff", "avFrecklesOn") },
    { key: "earrings", title: "avEarrings", tab: TAB_EXTRA, choices: toggle("avEarringsOff", "avEarringsOn") }
  ];
  const shown = $derived(look ? parts.filter((part) => part.tab === tab && (!part.show || part.show(look))) : []);

  /** The face a tile shows: the current look with one part swapped (never the photo, so the tiles stay drawn faces). */
  const tile = (key: keyof AvatarLook, value: Choice["value"]) => ({ a: 0, l: lookToCode({ ...look!, [key]: value }) });
  /** The face a quick-style tile shows: the current look with that style applied. */
  const styleTile = (n: number) => ({ a: 0, l: lookToCode(applyStyle(look!, n)) });

  let fileEl = $state<HTMLInputElement>();
</script>

<Sheet {open} title={t("avTitle")} onclose={closeAvatarBuilder} name="avatar">
  {#snippet head()}<p class="muted small">{p ? playerName(avatarEdit.i) : ""}</p>{/snippet}
  {#if p && look}
    <div class="bldtop">
      <div class="bldw">
        <div class="bldp" role="img" aria-label={t("avFor", { name: playerName(avatarEdit.i) })}><Avatar player={p} size={150} /></div>
        <div class="bldb">
          <button class="chip bd-dice" onclick={() => randomizeAvatar(avatarEdit.i)}><Icon name="dice" /><span class="sr-only">{t("avRandom")}</span></button>
          <button class="chip bd-cam" onclick={() => fileEl?.click()}><Icon name="cam" /><span class="sr-only">{p.ph ? t("avPhotoChange") : t("avPhotoAdd")}</span></button>
          {#if p.ph}<button class="chip bd-x" onclick={() => removePlayerPhoto(avatarEdit.i)}><Icon name="x" /><span class="sr-only">{t("avPhotoRemove")}</span></button>{/if}
          <input type="file" accept="image/*" hidden bind:this={fileEl} onchange={(e) => choosePhoto(avatarEdit.i, e.currentTarget)} />
        </div>
      </div>
    </div>
    {#if hasTwinLook(avatarEdit.i)}<p class="muted small bldn">{t("avTwin")}</p>{/if}
    <Panel class="pad bld">
      <p class="muted small bldl">{t("avStyle")}</p>
      <div class="chips">{#each { length: STYLE_COUNT } as _, n (n)}<button class="chip tile" onclick={() => setAvatarStyle(avatarEdit.i, n)} aria-pressed={hasStyle(look, n)} aria-label={t(STYLE_KEYS[n])}><Avatar player={styleTile(n)} size={44} /></button>{/each}</div>
      <div class="chips bldt">{#each tabs as [v, label], ki (ki)}<button class="chip bldtab" onclick={() => (tab = v)} aria-pressed={tab === v}>{label}</button>{/each}</div>
      {#each shown as part (part.key)}
        <p class="muted small bldl">{t(part.title)}</p>
        <div class="chips">{#each part.choices as c, ki (ki)}<button class="chip tile" onclick={() => setAvatarPart(avatarEdit.i, part.key, c.value as never)} aria-pressed={look[part.key] === c.value} aria-label={t(c.label)}>{#if c.none}<svg class="nox" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="14" fill="none" /><path d="M12.1 31.9L31.9 12.1" fill="none" /></svg>{:else}<Avatar player={tile(part.key, c.value)} size={44} />{/if}</button>{/each}</div>
      {/each}
    </Panel>
    {#if p.ph}<p class="muted small bldn">{t("avPhotoNote")}</p>{/if}
  {/if}
  <button class="btn go" onclick={closeAvatarBuilder}>{t("avDone")}</button>
</Sheet>
