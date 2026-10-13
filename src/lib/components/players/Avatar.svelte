<!-- Draws one avatar from a player ({ a, l?, ph? }): photo > look code l > legacy index a. -->
<script lang="ts">
  import { FILLS, INK } from "#lib/data/constants.ts";
  import { playerLook, BEARD, BEARD_FILL, BLUSH, BROWS, EARRING_STYLE, EARRINGS, FRECKLE_STYLE, FRECKLES, HAIR, HAIR_FILLS, LASHES, MOUTHS } from "#lib/components/players/avatar-parts.ts";

  /**
   * A player's avatar <svg>: 6 hats x (glasses | mustache), 3 skin tones, a shirt, or the player's photo; indexes from 12 up
   * add eyebrow styles, freckles and a beard (what each index means lives in avatar-parts.ts and must not change for 0-11).
   * A builder code `l` (when valid) wins over the index `a`; it can also add hair, clothes, other glasses frames and mouths, lashes,
   * lips, blush and earrings. Every one of those is "off" in the original looks, so a look without them draws exactly as before.
   * A photo wins over both and never gets the drawn extras (hats and clothes are the only things drawn on a photo).
   * `phclip` (the photo's circular clip) is defined once, in the sprite of src/app.html.
   */
  let { player, size = 56 }: { player: { a: number; l?: number; ph?: string } | number; size?: number } = $props();
  const ph = $derived(typeof player === "object" ? player.ph : undefined);
  const look = $derived(playerLook(typeof player === "object" ? player : { a: player }));
  const f = $derived(FILLS[look.skin]);
  const h = $derived(look.hat);
  const m = $derived(look.mustache);
  const brow = $derived(BROWS[look.brows]);
  const hair = $derived(HAIR[look.hair]);
  const hf = $derived(HAIR_FILLS[look.hairTone]);
  const mouth = $derived(MOUTHS[look.mouth]);
  const lips = $derived(look.lips);
  const lash = $derived(m || look.frames === 3 ? LASHES.near : LASHES.frame);
</script>

<!-- Big-head cartoon proportions: the head (drawn in its own 48-unit space, scaled up) is most of the picture, the body is a small bust.
     The viewBox has headroom above for the hats; the photo clip (#phclip in app.html) lives in the head's own space. -->
<svg class={ph ? "av ph" : "av"} width={size} height={size} viewBox="-5.5 -12 59 59" aria-hidden="true">
  <path d="M6 47C6 41 14 38 24 38S42 41 42 47z" fill={INK} />
  {#if look.outfit === 0}
    <path d="M19.5 39l4.5 6 4.5-6z" fill="#fff" />{#if look.tie}<path d="M24 42l-1.6 2.4 1.6 4.6 1.6-4.6z" fill={INK} />{/if}
  {:else if look.outfit === 1}
    <path d="M15.2 38.4Q24 52 32.8 38.4z" fill={f} stroke={INK} stroke-width="1.2" stroke-linejoin="round" />
  {:else if look.outfit === 2}
    <path d="M9.4 47C9.4 38.6 14.6 33.4 24 33.4S38.6 38.6 38.6 47z" fill={BEARD_FILL} stroke={INK} stroke-width="1.2" stroke-linejoin="round" /><path d="M18 38.2Q24 42.4 30 38.2L33.6 47H14.4z" fill={INK} /><path d="M21.2 42.4v4.6M26.8 42.4v4.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round" />
  {:else}
    <path d="M14.8 36.4h18.4l1.2 7.6Q24 47 13.6 44z" fill={BEARD_FILL} stroke={INK} stroke-width="1.2" stroke-linejoin="round" /><path d="M16 41.2Q24 44 32 41.2M16.6 38.8Q24 41.4 31.4 38.8" fill="none" stroke={INK} stroke-width="1" stroke-linecap="round" opacity=".55" />
  {/if}
  <g transform="translate(24 20) scale(1.2) translate(-24 -27)">
    {#if ph}
      <image href={ph} x="7.5" y="10.5" width="33" height="33" preserveAspectRatio="xMidYMid slice" clip-path="url(#phclip)" /><circle cx="24" cy="27" r="16.5" fill="none" stroke={INK} stroke-width="2.2" />
    {:else}
      {#if hair.back}<path d={hair.back} fill={hf} stroke={INK} stroke-width="1.4" stroke-linejoin="round" />{/if}
      <circle cx="7.5" cy="29" r="2.8" fill={f} stroke={INK} stroke-width="1.9" /><circle cx="40.5" cy="29" r="2.8" fill={f} stroke={INK} stroke-width="1.9" />
      <circle cx="24" cy="27" r="16.5" fill={f} stroke={INK} stroke-width="2.2" />{#if look.beard}<path d={BEARD} fill={BEARD_FILL} stroke={INK} stroke-width="1.4" stroke-linejoin="round" /><circle cx="24" cy="27" r="16.5" fill="none" stroke={INK} stroke-width="2.2" />{/if}
      {#if hair.front}<path d={hair.front} fill={hf} stroke={INK} stroke-width="1.4" stroke-linejoin="round" />{/if}
      {#if look.blush}<path d={BLUSH.d} stroke={INK} stroke-width={BLUSH.width} stroke-linecap="round" opacity={BLUSH.opacity} />{/if}<path d={brow.d} stroke={INK} stroke-width={brow.w} stroke-linecap="round" />
      <circle cx="18.5" cy="26.5" r="2.5" fill={INK} /><circle cx="29.5" cy="26.5" r="2.5" fill={INK} /><circle cx="19.3" cy="25.7" r=".8" fill="#fff" /><circle cx="30.3" cy="25.7" r=".8" fill="#fff" />{#if look.freckles}<path d={FRECKLES} stroke={INK} stroke-width={FRECKLE_STYLE.width} stroke-linecap="round" opacity={FRECKLE_STYLE.opacity} />{/if}
      {#if m}
        <path d="M16.5 33c2.5-3 5-2.5 7.5-.5 2.5-2 5-2.5 7.5.5-3 2.5-5.5 1.5-7.5-.5-2 2-4.5 3-7.5.5z" fill={INK} />
      {:else}
        {#if look.frames === 0}
          <circle cx="18.5" cy="26.5" r="5.2" fill="none" stroke={INK} stroke-width="1.8" /><circle cx="29.5" cy="26.5" r="5.2" fill="none" stroke={INK} stroke-width="1.8" /><path d="M23.7 26.5h.6" stroke={INK} stroke-width="1.8" />
        {:else if look.frames === 1}
          <rect x="13.4" y="22" width="10.2" height="9" rx="2.4" fill="none" stroke={INK} stroke-width="1.8" /><rect x="24.4" y="22" width="10.2" height="9" rx="2.4" fill="none" stroke={INK} stroke-width="1.8" /><path d="M23.6 25.4h.8" stroke={INK} stroke-width="1.8" />
        {:else if look.frames === 2}
          <rect x="13" y="22.4" width="10.8" height="8.8" rx="3.6" fill={INK} /><rect x="24.2" y="22.4" width="10.8" height="8.8" rx="3.6" fill={INK} /><path d="M23.8 25.2h.4" stroke={INK} stroke-width="1.8" /><path d="M15.4 25.4l2.2-1.7M26.6 25.4l2.2-1.7" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".75" />
        {/if}
        <path d={mouth.d} fill={mouth.fill ? INK : "none"} stroke={mouth.fill && !lips ? "none" : INK} stroke-width={lips ? (mouth.fill ? 1.8 : 3) : 2} stroke-linecap="round" stroke-linejoin={mouth.fill ? "round" : undefined} />{#if mouth.teeth}<path d={mouth.teeth} stroke="#fff" stroke-width="1.4" stroke-linecap="round" />{/if}
      {/if}
      {#if look.lashes}<path d={lash} stroke={INK} stroke-width={LASHES.width} stroke-linecap="round" />{/if}
      {#if look.earrings}<path d={EARRINGS} stroke={INK} stroke-width={EARRING_STYLE.width} stroke-linecap="round" />{/if}
    {/if}
    {#if h === 0}
      <ellipse cx="24" cy="12" rx="17" ry="3.5" fill={INK} /><path d="M15 12C15 2 33 2 33 12z" fill={INK} /><rect x="15" y="8" width="18" height="2" fill="#fff" />
    {:else if h === 1}
      <path d="M9 15C9 1 39 1 39 15z" fill={INK} /><circle cx="24" cy="3" r="3" fill={INK} /><path d="M10 12h28" stroke="#fff" stroke-width="1.5" />
    {:else if h === 2}
      <path d="M10 14C10 3 38 3 38 14z" fill={INK} /><path d="M30 13h12" stroke={INK} stroke-width="3.5" stroke-linecap="round" />
    {:else if h === 3}
      <rect x="16" y="1" width="16" height="11" rx="1.5" fill={INK} /><ellipse cx="24" cy="12" rx="15" ry="3" fill={INK} /><rect x="16" y="8" width="16" height="2" fill="#fff" />
    {:else if h === 4}
      <path d="M13 12C13 3 35 3 35 12z" fill={INK} /><ellipse cx="24" cy="12" rx="16" ry="2.8" fill={INK} />
    {:else if h === 5}
      <path d="M8.5 21Q24 13 39.5 21" fill="none" stroke={INK} stroke-width="4" stroke-linecap="round" /><path d="M38 20l6-3-1 7z" fill={INK} />
    {/if}
  </g>
</svg>
