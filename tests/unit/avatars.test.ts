// @vitest-environment jsdom
/**
 * Avatars: the saved index `Player.a` must keep meaning the same face (0-11 = the original looks), and the extra variants
 * (eyebrows, freckles, beard) must give every index up to AVATAR_COUNT its own face. The look code `Player.l` grew by hair, clothes,
 * frames, mouths and face extras: every code saved before that (0-4095) must still decode to the same face. `AVATAR_DUMP=/tmp/av pnpm test avatars`
 * writes every avatar as an .svg file so the faces can be looked at.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import {
  AVATAR_COUNT, BASE_AVATARS, BASIC_LOOK_MAX, BROW_ORDER, BROWS, DEFAULT_LOOK, HAIR, HAIR_COUNT, HAT_COUNT, LOOK_BITS, LOOK_MAX, MOUTHS, NO_HAT, PLAIN_EXTRAS,
  STYLE_COUNT, VARIANTS, applyStyle, avatarLook, closestIndex, codeToIndex, codeToLook, hasStyle, indexToCode, isLookCode, lookToCode, playerCode, playerLook,
  randomFreeCode, randomLook, type AvatarLook
} from "#lib/components/players/avatar-parts.ts";

describe("avatarLook", () => {
  it("keeps the original 12 looks exactly as they were saved (hat a%6, skin a%3, mustache from 6, tie on odd)", () => {
    for (let a = 0; a < BASE_AVATARS; a++) {
      expect(avatarLook(a)).toMatchObject({
        hat: a % 6,
        skin: a % 3,
        mustache: a >= 6,
        tie: a % 2 === 1,
        brows: "base",
        freckles: false,
        beard: false
      });
    }
  });

  it("an index from a higher variant has the same hat, skin, glasses/mustache and tie as its base look, plus extras", () => {
    for (let a = BASE_AVATARS; a < AVATAR_COUNT; a++) {
      const base = avatarLook(a % BASE_AVATARS);
      const look = avatarLook(a);
      expect([look.hat, look.skin, look.mustache, look.tie]).toEqual([base.hat, base.skin, base.mustache, base.tie]);
      expect(look.brows !== "base" || look.freckles || look.beard).toBe(true);
    }
  });

  it("every index below AVATAR_COUNT is a different face", () => {
    const faces = new Set(Array.from({ length: AVATAR_COUNT }, (_, a) => JSON.stringify(avatarLook(a))));
    expect(faces.size).toBe(AVATAR_COUNT);
    expect(AVATAR_COUNT).toBe(BASE_AVATARS * VARIANTS.length);
  });

  it("accepts any number: negative, fractional, too big, NaN", () => {
    expect(avatarLook(AVATAR_COUNT + 3)).toEqual(avatarLook(3));
    expect(avatarLook(-1)).toEqual(avatarLook(AVATAR_COUNT - 1));
    expect(avatarLook(2.9)).toEqual(avatarLook(2));
    expect(avatarLook(NaN)).toEqual(avatarLook(0));
  });
});

describe("look codec (Player.l is saved data)", () => {
  /** A deterministic rng cycling through fixed values. */
  const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

  it("pins the layout: bit positions, the brow order and the code range cannot silently change meaning", () => {
    expect(LOOK_BITS).toEqual({
      hat: 0, skin: 3, mustache: 5, tie: 6, brows: 7, freckles: 10, beard: 11,
      hair: 12, hairTone: 15, lashes: 17, lips: 18, earrings: 19, blush: 20, outfit: 21, frames: 23, mouth: 25
    });
    expect(BROW_ORDER).toEqual(["base", "arched", "thick", "angry", "flat"]);
    expect(Object.keys(BROWS).sort()).toEqual([...BROW_ORDER].sort());
    expect(BASIC_LOOK_MAX).toBe(4095);
    expect(LOOK_MAX).toBe(2 ** 28 - 1);
    // a few fixed codes: hat 3, skin 2, mustache, tie, brows "angry" (3), freckles, beard
    const plain = { ...DEFAULT_LOOK, hat: 0, skin: 0, mustache: false, tie: false, brows: "base" as const, freckles: false, beard: false };
    expect(lookToCode({ ...plain, hat: 3, skin: 2, mustache: true, tie: true, brows: "angry", freckles: true, beard: true })).toBe(3 | (2 << 3) | (1 << 5) | (1 << 6) | (3 << 7) | (1 << 10) | (1 << 11));
    expect(lookToCode(plain)).toBe(0);
    expect(lookToCode({ ...plain, hat: 5, skin: 2, brows: "flat" })).toBe(5 + 16 + 512);
    // the later features: hair 3, hair tone 2, lashes, lips, earrings, blush, clothes 1, frames 2, mouth 4
    expect(lookToCode({ ...plain, hair: 3, hairTone: 2, lashes: true, lips: true, earrings: true, blush: true, outfit: 1, frames: 2, mouth: 4 }))
      .toBe((3 << 12) | (2 << 15) | (1 << 17) | (1 << 18) | (1 << 19) | (1 << 20) | (1 << 21) | (2 << 23) | (4 << 25));
  });

  it("indexToCode is lossless for all 48 legacy indexes, and the 48 codes are all different", () => {
    for (let a = 0; a < AVATAR_COUNT; a++) {
      expect(codeToLook(indexToCode(a))).toEqual(avatarLook(a));
      expect(codeToIndex(indexToCode(a))).toBe(a);
    }
    expect(new Set(Array.from({ length: AVATAR_COUNT }, (_, a) => indexToCode(a))).size).toBe(AVATAR_COUNT);
  });

  it("every look code saved before the hair and face extras existed (0-4095, hat 0-5) still decodes to the same face, with every extra off", () => {
    for (let code = 0; code <= BASIC_LOOK_MAX; code++) {
      if ((code & 7) >= 6 || ((code >> 3) & 3) >= 3 || ((code >> 7) & 7) >= BROW_ORDER.length) {
        continue; // not a code the old builder could save
      }
      expect(isLookCode(code)).toBe(true);
      const look = codeToLook(code);
      expect(look).toMatchObject({ hat: code & 7, skin: (code >> 3) & 3, mustache: ((code >> 5) & 1) === 1, tie: ((code >> 6) & 1) === 1, freckles: ((code >> 10) & 1) === 1, beard: ((code >> 11) & 1) === 1 });
      expect(look).toMatchObject(PLAIN_EXTRAS);
    }
  });

  it("the extras of the 48 legacy faces are all off", () => {
    for (let a = 0; a < AVATAR_COUNT; a++) {
      expect(avatarLook(a)).toMatchObject(PLAIN_EXTRAS);
      expect(indexToCode(a)).toBeLessThanOrEqual(BASIC_LOOK_MAX);
    }
  });

  it("every code 0-4095 decodes or falls back to the default look, never throws, and valid codes round-trip", () => {
    let valid = 0;
    for (let code = 0; code <= BASIC_LOOK_MAX; code++) {
      const look = codeToLook(code);
      if (isLookCode(code)) {
        valid++;
        expect(lookToCode(look)).toBe(code);
      }
      else {
        expect(look).toEqual(DEFAULT_LOOK);
      }
    }
    expect(valid).toBe(HAT_COUNT * 3 * 2 * 2 * 5 * 2 * 2); // 1680 looks without hair, clothes and face extras
  });

  it("codes across the whole range round-trip: valid ones decode and encode to themselves, invalid ones give the default look", () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    let valid = 0;
    for (let n = 0; n < 20000; n++) {
      const code = next() % (LOOK_MAX + 1);
      if (isLookCode(code)) {
        valid++;
        expect(lookToCode(codeToLook(code))).toBe(code);
      }
      else {
        expect(codeToLook(code)).toEqual(DEFAULT_LOOK);
      }
    }
    expect(valid).toBeGreaterThan(1000);
    expect(isLookCode(LOOK_MAX)).toBe(false); // hat 7, hair tone 3, ... are not real parts
  });

  it("every part of a look, set to its highest value, survives the codec", () => {
    const top: AvatarLook = {
      hat: NO_HAT, skin: 2, mustache: true, tie: true, brows: "flat", freckles: true, beard: true,
      hair: HAIR_COUNT - 1, hairTone: 2, lashes: true, lips: true, earrings: true, blush: true, outfit: 3, frames: 3, mouth: MOUTHS.length - 1
    };
    const code = lookToCode(top);
    expect(isLookCode(code)).toBe(true);
    expect(codeToLook(code)).toEqual(top);
    expect(code).toBeLessThanOrEqual(LOOK_MAX);
  });

  it("every hair style and mouth is drawable data", () => {
    expect(HAIR).toHaveLength(8);
    expect(HAIR[0]).toEqual({});
    for (const h of HAIR.slice(1)) {
      expect(h.front ?? h.back).toBeTruthy();
    }
    expect(MOUTHS).toHaveLength(5);
  });

  it("invalid input (NaN, fractions, negatives, too big, wrong types) gives the default look", () => {
    for (const bad of [NaN, Infinity, -1, 0.5, LOOK_MAX + 1, 1e10, "12", null, undefined, {}, [], 7]) {
      expect(isLookCode(bad)).toBe(false);
      expect(codeToLook(bad)).toEqual(DEFAULT_LOOK);
    }
    expect(DEFAULT_LOOK).toEqual(avatarLook(0));
  });

  it("lookToCode never produces an invalid code, even from out-of-range parts", () => {
    const code = lookToCode({ ...DEFAULT_LOOK, hat: 9, skin: -2, brows: "nope" as never, hair: 99, hairTone: -1, outfit: 1.5, frames: 4, mouth: 7 });
    expect(isLookCode(code)).toBe(true);
    expect(codeToLook(code)).toEqual(DEFAULT_LOOK);
  });

  it("randomLook always gives a valid look, from any rng value including 0 and 0.999", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999999]) {
      expect(isLookCode(lookToCode(randomLook(() => r)))).toBe(true);
    }
    for (let n = 0; n < 200; n++) {
      expect(isLookCode(lookToCode(randomLook()))).toBe(true);
    }
    // an rng stuck at 0 gives a "masculine" face: the first seven draws are the original ones
    expect(randomLook(seq(0))).toEqual({
      hat: 0, skin: 0, mustache: true, tie: true, brows: "base", freckles: true, beard: true,
      hair: 0, hairTone: 0, lashes: false, lips: false, earrings: true, blush: false, outfit: 0, frames: 0, mouth: 0
    });
  });

  it("randomLook: a feminine face never has a beard or a mustache, a masculine one never has lashes or lipstick", () => {
    let feminine = 0, masculine = 0;
    for (let n = 0; n < 400; n++) {
      const look = randomLook();
      if ([3, 4, 5, 6].includes(look.hair) && look.lips) {
        feminine++;
        expect(look.beard || look.mustache).toBe(false);
      }
      if (!look.lashes && !look.lips) {
        masculine++;
      }
      expect(isLookCode(lookToCode(look))).toBe(true);
    }
    expect(feminine).toBeGreaterThan(20);
    expect(masculine).toBeGreaterThan(20);
  });

  it("randomFreeCode avoids taken codes, even when luck fails, and still answers when every code is taken", () => {
    const taken = [lookToCode(randomLook(seq(0.3)))];
    expect(taken).not.toContain(randomFreeCode(taken, seq(0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.9)));
    // an rng that only ever gives the same look: falls back to scanning for the first free valid code
    const stuck = lookToCode(randomLook(seq(0.3)));
    const free = randomFreeCode([stuck], seq(0.3));
    expect(free).not.toBe(stuck);
    expect(isLookCode(free)).toBe(true);
    const all = Array.from({ length: BASIC_LOOK_MAX + 1 }, (_, c) => c); // every look of the old 12 bits is taken: the scan goes on into hair and extras
    const last = randomFreeCode(all, seq(0.3));
    expect(isLookCode(last)).toBe(true);
    expect(all).not.toContain(last);
  });

  it("playerCode / playerLook: the builder code wins, an invalid or missing code falls back to the legacy index", () => {
    const l = lookToCode({ ...DEFAULT_LOOK, hat: 4, skin: 1, tie: true, brows: "thick", beard: true, hair: 5, lashes: true });
    expect(playerCode({ a: 3, l })).toBe(l);
    expect(playerLook({ a: 3, l })).toEqual(codeToLook(l));
    expect(playerCode({ a: 3 })).toBe(indexToCode(3));
    expect(playerLook({ a: 30, l: LOOK_MAX + 1 })).toEqual(avatarLook(30));
  });

  it("closestIndex returns a legacy index that matches the main parts when no exact face exists", () => {
    const look = { ...DEFAULT_LOOK, hat: 1, skin: 0, brows: "flat" as const };
    expect(codeToIndex(lookToCode(look))).toBeNull();
    const idx = closestIndex(look);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(AVATAR_COUNT);
    expect(avatarLook(idx).hat).toBe(1);
  });
});

describe("quick styles", () => {
  it("each style sets its parts and keeps the rest of the look", () => {
    const look: AvatarLook = { ...DEFAULT_LOOK, hat: 3, skin: 2, brows: "thick", freckles: true, mustache: true, beard: true, tie: true };
    const woman = applyStyle(look, 2);
    expect(woman).toMatchObject({ hat: 3, skin: 2, brows: "thick", freckles: true, hair: 3, lashes: true, lips: true, earrings: true, outfit: 1, mustache: false, beard: false, tie: false });
    const man = applyStyle(look, 1);
    expect(man).toMatchObject({ hat: 3, mustache: true, beard: true, hair: 1, lashes: false, outfit: 0 });
    expect(applyStyle(woman, 0)).toMatchObject({ hat: 3, skin: 2, ...PLAIN_EXTRAS });
    expect(applyStyle(look, 3)).toMatchObject({ hair: 2, outfit: 2, frames: 2, mustache: false });
    expect(applyStyle(look, 99)).toBe(look);
  });

  it("hasStyle is true right after applying a style, and false for the others", () => {
    for (let n = 0; n < STYLE_COUNT; n++) {
      const look = applyStyle(DEFAULT_LOOK, n);
      expect(hasStyle(look, n)).toBe(true);
      expect(isLookCode(lookToCode(look))).toBe(true);
    }
    expect(hasStyle(applyStyle(DEFAULT_LOOK, 2), 1)).toBe(false);
    expect(hasStyle(DEFAULT_LOOK, 99)).toBe(false);
  });

  it("setAvatarStyle (the store) applies a style to one player only", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { setAvatarStyle } = await import("#lib/stores/players.svelte.ts");
    state.players = [{ n: "A", a: 0 }, { n: "B", a: 1 }];
    setAvatarStyle(0, 2);
    expect(playerLook(state.players[0])).toMatchObject({ hair: 3, lashes: true, outfit: 1 });
    expect(state.players[1]).toEqual({ n: "B", a: 1 });
    setAvatarStyle(5, 2); // no such player: ignored
    expect(state.players).toHaveLength(2);
  });
});

describe("avatars in the app", () => {
  const players = (...avatars: number[]) => avatars.map((a, i) => ({ n: "P" + i, a }));
  beforeAll(() => {
    // the settings store reads matchMedia when it loads; sounds and vibration are no-ops without AudioContext / navigator.vibrate
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  });

  it("addPlayer gives every new player a builder look that nobody at the table has (also past 12 and past 48 players)", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { addPlayer } = await import("#lib/stores/players.svelte.ts");
    state.players = players(0, 1, 2);
    for (let n = 0; n < 60; n++) {
      addPlayer();
    }
    const codes = state.players.map((p) => playerCode(p));
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of state.players.slice(3)) {
      expect(isLookCode(p.l)).toBe(true);
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.a).toBeLessThan(AVATAR_COUNT);
    }
  });

  it("setAvatarPart changes one part live; `a` follows only when a legacy face matches, otherwise it stays", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { setAvatarPart } = await import("#lib/stores/players.svelte.ts");
    state.players = players(0, 1, 2);
    setAvatarPart(0, "mustache", true); // hat 0, skin 0, mustache, no tie = legacy 6
    expect(state.players[0].a).toBe(6);
    expect(codeToLook(state.players[0].l)).toEqual(avatarLook(6));
    setAvatarPart(0, "hat", 3); // hat 3 + skin 0 exists in no legacy face: `a` stays 6
    expect(state.players[0].a).toBe(6);
    expect(codeToLook(state.players[0].l)).toMatchObject({ hat: 3, skin: 0, mustache: true });
    expect(state.players[1]).toEqual({ n: "P1", a: 1 }); // nobody else is touched
    setAvatarPart(5, "hat", 1); // no such player: ignored
    expect(state.players).toHaveLength(3);
  });

  it("a built look keeps its photo and the saved JSON carries `l`; an old player without `l` is unchanged", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { setAvatarPart } = await import("#lib/stores/players.svelte.ts");
    state.players = players(0, 1, 2);
    state.players[0].ph = "data:image/jpeg;base64,AAAA";
    setAvatarPart(0, "skin", 2);
    expect(state.players[0].ph).toBe("data:image/jpeg;base64,AAAA");
    const saved = JSON.parse(JSON.stringify(state.players));
    expect(typeof saved[0].l).toBe("number");
    expect("l" in saved[1]).toBe(false);
  });

  it("randomizeAvatar stores a valid code", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { randomizeAvatar } = await import("#lib/stores/players.svelte.ts");
    state.players = players(0, 1, 2);
    randomizeAvatar(1);
    expect(isLookCode(state.players[1].l)).toBe(true);
  });

  it("hasTwinLook is true only when another player has exactly the same face", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    const { hasTwinLook } = await import("#lib/stores/players.svelte.ts");
    state.players = [{ n: "A", a: 6 }, { n: "B", a: 1 }, { n: "C", a: 2, l: indexToCode(6) }];
    expect(hasTwinLook(0)).toBe(true);
    expect(hasTwinLook(2)).toBe(true);
    expect(hasTwinLook(1)).toBe(false);
  });
});

describe("Avatar component", () => {
  const render = async (player: { a: number; l?: number; ph?: string }) => {
    const { default: Avatar } = await import("#lib/components/players/Avatar.svelte");
    document.body.innerHTML = '<div id="t"></div>';
    const app = mount(Avatar, { target: document.getElementById("t")!, props: { player, size: 64 } });
    flushSync();
    const svg = document.querySelector("svg")!.outerHTML;
    unmount(app);
    return svg;
  };

  it("draws a beard, freckles and eyebrow strokes only for the variants that have them", async () => {
    const plain = await render({ a: 0 });
    const freckled = await render({ a: 12 });
    const bearded = await render({ a: 24 });
    expect(plain).not.toContain("h0M"); // no freckle dots
    expect(freckled).toContain("h0M");
    expect(bearded).toContain("M7.7 29.5A16.5");
    expect(plain).not.toContain("M7.7 29.5A16.5");
    expect(bearded).toContain('stroke-width="3"'); // thick brows
  });

  it("a look without the later extras draws none of them", async () => {
    for (const a of [0, 1, 13, 25]) {
      const svg = await render({ a });
      for (const h of HAIR.slice(1)) {
        expect(svg).not.toContain(h.front ?? h.back!);
      }
      expect(svg).not.toContain('rx="2.4"'); // no square glasses
      expect(svg).not.toContain('rx="3.6"'); // no sunglasses
      expect(svg).not.toContain("M15.3 26.9L13.4"); // no lashes
      expect(svg).not.toContain("M7.5 34.2h0"); // no earrings
      expect(svg).toContain("M19.5 34q4.5 3.5 9 0"); // the original smile
    }
  });

  it("draws hair, lashes, lips, earrings, blush, frames, mouths and clothes only when the look has them", async () => {
    const draw = (look: Partial<AvatarLook>) => render({ a: 0, l: lookToCode({ ...DEFAULT_LOOK, ...look }) });
    const long = await draw({ hair: 3, hairTone: 1 });
    expect(long).toContain(HAIR[3].back!);
    expect(long).toContain(HAIR[3].front!);
    expect(long).toContain('fill="#52525D"'); // grey hair
    expect(await draw({ hair: 1 })).not.toContain(HAIR[1].back ?? "no back");
    expect(await draw({ lashes: true })).toContain("M12.7 27.5L10.7 27.9"); // lashes outside the glasses
    expect(await draw({ lashes: true, frames: 3 })).toContain("M15.3 26.9L13.4 27.2"); // lashes close to the bare eye
    expect(await draw({ lips: true })).toContain('stroke-width="3"');
    expect(await draw({ earrings: true })).toContain("M7.5 34.2h0");
    expect(await draw({ blush: true })).toContain("M13.2 33.4h0");
    expect(await draw({ frames: 1 })).toContain('rx="2.4"'); // square frames
    expect(await draw({ frames: 2 })).toContain('rx="3.6"'); // sunglasses
    expect(await draw({ frames: 3 })).not.toContain('r="5.2"');
    expect(await draw({ mouth: 1 })).toContain(MOUTHS[1].d);
    expect(await draw({ mouth: 3 })).toContain(MOUTHS[3].d);
    expect(await draw({ outfit: 1 })).toContain("M15.2 38.4Q24 52 32.8 38.4z");
    expect(await draw({ outfit: 1 })).not.toContain("M19.5 39l4.5 6 4.5-6z"); // no shirt collar under a blouse
    expect(await draw({ outfit: 2 })).toContain("M21.2 42.4v4.6"); // hoodie strings
    expect(await draw({ outfit: 3 })).toContain("M14.8 36.4h18.4");
    expect(await draw({ outfit: 3, tie: true })).not.toContain("M24 42l-1.6 2.4"); // the tie goes with the shirt only
  });

  it("with a mustache there are no glasses, mouth or lipstick, but lashes still show", async () => {
    const svg = await render({ a: 0, l: lookToCode({ ...DEFAULT_LOOK, mustache: true, frames: 2, mouth: 3, lips: true, lashes: true }) });
    expect(svg).not.toContain('rx="3.6"');
    expect(svg).not.toContain(MOUTHS[3].d);
    expect(svg).toContain("M15.3 26.9L13.4 27.2");
  });

  it("no hat draws no hat shape", async () => {
    const hatted = await render({ a: 0, l: lookToCode({ ...DEFAULT_LOOK, hat: 5 }) });
    const bare = await render({ a: 0, l: lookToCode({ ...DEFAULT_LOOK, hat: NO_HAT }) });
    expect(hatted).toContain("M8.5 21Q24 13 39.5 21");
    expect(bare).not.toContain("M8.5 21Q24 13 39.5 21");
    expect(bare).not.toContain("<ellipse");
  });

  it("a photo avatar never gets the drawn hair or face extras, but keeps its clothes", async () => {
    const svg = await render({ a: 0, l: lookToCode({ ...DEFAULT_LOOK, hair: 3, lashes: true, earrings: true, outfit: 2 }), ph: "data:image/jpeg;base64,AAAA" });
    expect(svg).toContain("<image");
    expect(svg).not.toContain(HAIR[3].back!);
    expect(svg).not.toContain("M15.3 26.9L13.4");
    expect(svg).not.toContain("M7.5 34.2h0");
    expect(svg).toContain("M21.2 42.4v4.6");
  });

  it("a photo avatar never gets the drawn extras", async () => {
    const svg = await render({ a: 24, ph: "data:image/jpeg;base64,AAAA" });
    expect(svg).toContain("<image");
    expect(svg).not.toContain("M7.7 29.5A16.5");
  });

  it("legacy `a` renders exactly the same with or without its own code, for all 48 indexes", async () => {
    for (let a = 0; a < AVATAR_COUNT; a++) {
      expect(await render({ a, l: indexToCode(a) })).toBe(await render({ a }));
    }
  });

  it("draws from `l` when present, ignores an invalid `l`, and a photo still wins over `l`", async () => {
    const l = lookToCode({ ...DEFAULT_LOOK, hat: 3, skin: 2, brows: "flat", freckles: true, beard: true });
    const built = await render({ a: 0, l });
    expect(built).toContain("M7.7 29.5A16.5"); // beard
    expect(built).toContain("h0M"); // freckles
    expect(built).toContain(BROWS.flat.d);
    expect(built).not.toBe(await render({ a: 0 }));
    expect(await render({ a: 30, l: LOOK_MAX + 1 })).toBe(await render({ a: 30 }));
    const photo = await render({ a: 0, l, ph: "data:image/jpeg;base64,AAAA" });
    expect(photo).toContain("<image");
    expect(photo).not.toContain("M7.7 29.5A16.5");
    expect(photo).not.toContain("h0M");
  });

  it.runIf(!!process.env.AVATAR_DUMP)("dumps every avatar as an svg file", async () => {
    const dir = process.env.AVATAR_DUMP!;
    mkdirSync(dir, { recursive: true });
    for (let a = 0; a < AVATAR_COUNT; a++) {
      const svg = (await render({ a })).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      writeFileSync(`${dir}/${String(a).padStart(2, "0")}.svg`, svg);
    }
  });

  // Every builder choice, for looking at overlaps: each hat x each brow style (plain face), and the glasses / mustache / beard / freckles combinations.
  it.runIf(!!process.env.AVATAR_DUMP)("dumps the builder combinations as svg files", async () => {
    const dir = process.env.AVATAR_DUMP! + "/builder";
    mkdirSync(dir, { recursive: true });
    const save = async (name: string, look: ReturnType<typeof avatarLook>) => {
      const svg = (await render({ a: 0, l: lookToCode(look) })).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      writeFileSync(`${dir}/${name}.svg`, svg);
    };
    for (let hat = 0; hat < 6; hat++) {
      for (const brows of BROW_ORDER) {
        await save(`hat${hat}-${brows}`, { ...avatarLook(0), hat, brows });
      }
    }
    // the later extras: every hair style x colour without a hat, every outfit, frames, mouth, and the quick styles
    for (let hair = 0; hair < HAIR_COUNT; hair++) {
      for (let hairTone = 0; hairTone < 3; hairTone++) {
        await save(`hair${hair}-tone${hairTone}`, { ...avatarLook(0), hat: NO_HAT, hair, hairTone });
      }
    }
    for (let outfit = 0; outfit < 4; outfit++) {
      for (let frames = 0; frames < 4; frames++) {
        await save(`outfit${outfit}-frames${frames}`, { ...avatarLook(0), hat: NO_HAT, hair: 4, outfit, frames, lashes: frames === 3 });
      }
    }
    for (let mouth = 0; mouth < MOUTHS.length; mouth++) {
      for (const lips of [false, true]) {
        await save(`mouth${mouth}-${lips ? "lips" : "nolips"}`, { ...avatarLook(0), hat: NO_HAT, hair: 1, frames: 3, mouth, lips });
      }
    }
    for (let style = 0; style < STYLE_COUNT; style++) {
      await save(`style${style}`, applyStyle(avatarLook(0), style));
    }
    for (const mustache of [false, true]) {
      for (const beard of [false, true]) {
        for (const freckles of [false, true]) {
          for (const tie of [false, true]) {
            await save(`${mustache ? "must" : "glass"}-${beard ? "beard" : "nobeard"}-${freckles ? "frk" : "nofrk"}-${tie ? "tie" : "notie"}`, { ...avatarLook(0), mustache, beard, freckles, tie });
          }
        }
      }
    }
  });
});
