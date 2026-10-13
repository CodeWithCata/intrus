/**
 * What an avatar looks like, as plain data. `Player.a` is the avatar index and is SAVED in users' browsers, so the meaning of
 * the indexes 0-11 must never change (they are the "original" 12 looks). Higher indexes only ADD features on top of the same
 * 12 looks, so every saved game still shows the same faces.
 *
 *   a % 12 -> the base look: hat (a % 6: cap, beanie, ...), skin tone (a % 3), glasses or mustache, tie or none
 *   floor(a / 12) -> the variant (VARIANTS below): extra eyebrows / freckles / beard. Variant 0 is the plain original.
 *
 * Avatar.svelte draws this; players.svelte.ts hands out looks. Keep both numbers in sync with the data here.
 *
 * The avatar BUILDER saves a second, optional field, `Player.l`: a bit-packed look code (see LOOK_BITS) that wins over `a`.
 * A player without `l` looks exactly as before. The bit layout and BROW_ORDER are SAVED DATA: never change them.
 * New features only ever ADD bits on top (bits 12 and up, where 0 always means "the original look"), so every code saved
 * before a feature existed still decodes to the same face.
 */

/** Number of original looks (hat x glasses|mustache, skin tones). */
export const BASE_AVATARS = 12;

export type BrowStyle = "base" | "arched" | "thick" | "angry" | "flat";

/** Eyebrow strokes in the head's own 48-unit space. `base` is the original pair, so variant 0 is unchanged. */
export const BROWS: Record<BrowStyle, { d: string; w: number }> = {
    base: { d: "M13.5 20.2l5.5-1.6M29 18.6l5.5 1.6", w: 1.7 },
    arched: { d: "M13.3 20.6q3.1-3.4 6.2-.3M28.5 20.3q3.1-3.1 6.2.3", w: 1.7 },
    thick: { d: "M13.2 19.7h6.4M28.4 19.7h6.4", w: 3 },
    angry: { d: "M13.4 17.9l6 2.5M34.6 17.9l-6 2.5", w: 1.9 },
    flat: { d: "M13.5 19.3h5.8M28.7 19.3h5.8", w: 1.7 }
};

/** Freckles: zero-length round-capped strokes, so all eight are ONE path (four on each cheek). Drawn with FRECKLE_STYLE. */
export const FRECKLES = "M12.2 31.2h0M15.3 32.6h0M12.9 34.3h0M16.1 35.3h0M35.8 31.2h0M32.7 32.6h0M35.1 34.3h0M31.9 35.3h0";
export const FRECKLE_STYLE = { width: 2.1, opacity: 0.8 } as const;

/**
 * A beard that stays inside the head outline: it follows the jaw from ear to ear, about 5 units thick at the chin, and leaves
 * the cheeks and the mouth free. Drawn mid-grey (BEARD_FILL) with a thin ink edge, so it reads as a beard, not as a black mask.
 */
export const BEARD = "M7.7 29.5A16.5 16.5 0 0 0 40.3 29.5C39.3 34.6 33.8 38.3 24 38.3S8.7 34.6 7.7 29.5z";
export const BEARD_FILL = "#52525D";

/** Hair colours (index = hair tone): ink, mid-grey like the beard, and white (always drawn with an ink edge). Tone 0 is INK. */
export const HAIR_FILLS = ["#111114", BEARD_FILL, "#FFFFFF"] as const;

/** Hair styles: `back` is drawn behind the head (and ears), `front` over the head and under the hat. Both are in the head's 48-unit space. Style 0 is bald (the original). */
export interface HairStyle {
    back?: string;
    front?: string;
}
export const HAIR: readonly HairStyle[] = [
    {},
    // 1 short crop
    { front: "M7.6 26.5C5.9 13.6 14.2 8.6 24 8.6S42.1 13.6 40.4 26.5C38.6 21.4 36.5 17.8 33.6 15.8 30 16.8 18 16.8 14.4 15.8 11.5 17.8 9.4 21.4 7.6 26.5z" },
    // 2 side-swept fringe
    { front: "M7.4 27C5.4 13 14.4 8.2 24 8.2S42.6 13 40.6 27C39.4 21.4 37.4 18 34.4 15.8 29.8 19 21.4 19.4 13.8 18.2 10.8 19.6 8.8 23.2 7.4 27z" },
    // 3 long, centre parting
    {
        back: "M7 26C4.8 8.2 14.6 6.4 24 6.4S43.2 8.2 41 26C40.6 33 43.6 40.2 44.6 46.2Q44.8 48.6 42 48.6H6Q3.2 48.6 3.4 46.2C4.4 40.2 7.4 33 7 26z",
        front: "M7.7 27C5.8 13.4 14.4 8.4 24 8.4S42.2 13.4 40.3 27C38.7 20.2 33.2 15.2 24 13.2 14.8 15.2 9.3 20.2 7.7 27z"
    },
    // 4 bob
    {
        back: "M6.6 25C4.6 8.6 14.6 6.8 24 6.8S43.4 8.6 41.4 25C41.8 31 43 35.4 40.6 39.6 36.6 40.6 35.6 36 35.6 31H12.4C12.4 36 11.4 40.6 7.4 39.6 5 35.4 6.2 31 6.6 25z",
        front: "M7.6 26.5C6 13.6 14.4 8.6 24 8.6S42 13.6 40.4 26.5C38.8 19.4 33.6 14.6 24 14.6S9.2 19.4 7.6 26.5z"
    },
    // 5 side ponytail
    {
        back: "M30.6 9.6C37.6 4.4 47.6 9.2 46.4 19 45.8 25.2 48 30 44.6 36.6 43.8 30.6 41.2 27.2 40.4 21.4 39.8 16.4 36.4 13.6 30.6 14.4z",
        front: "M7.6 26.5C5.9 13.6 14.2 8.6 24 8.6S42.1 13.6 40.4 26.5C38.6 21.4 36.5 17.8 33.6 15.8 30 16.8 18 16.8 14.4 15.8 11.5 17.8 9.4 21.4 7.6 26.5z"
    },
    // 6 top bun
    {
        back: "M24 1.6A5.4 5.4 0 1 1 23.99 1.6z",
        front: "M7.6 26.5C5.9 13.6 14.2 8.6 24 8.6S42.1 13.6 40.4 26.5C38.6 21.4 36.5 17.8 33.6 15.8 30 16.8 18 16.8 14.4 15.8 11.5 17.8 9.4 21.4 7.6 26.5z"
    },
    // 7 curly / afro
    {
        back: "M9.4 22.6C3.6 21.4 2.6 11.4 10.4 10.4 10.8 3.6 20.4 1.4 24 5.2 27.8 1.2 37.6 3.6 37.8 10.4 45.6 11.2 44.6 21.6 38.6 22.6 42 28.4 40 34.6 37 33.6 36.2 29.4 34.4 27 34 25.6H14C13.6 27 11.8 29.4 11 33.6 8 34.6 6 28.4 9.4 22.6z",
        front: "M8 26C6.4 15.8 11.6 11.2 15 12.8 17.6 9.8 22 9.4 24 11.2 26 9.4 30.4 9.8 33 12.8 36.4 11.2 41.6 15.8 40 26 38.4 21.4 37 18.8 34.6 17.6 30.6 20 17.4 20 13.4 17.6 11 18.8 9.6 21.4 8 26z"
    }
];

/** Which hair styles `randomLook` gives to a feminine and to a masculine face (indexes into HAIR). */
const FEMININE_HAIR: readonly number[] = [3, 4, 5, 6, 7, 2];
const MASCULINE_HAIR: readonly number[] = [0, 1, 1, 2, 7];

/** Eyelashes: three strokes on each eye's outer top corner. `near` hugs the bare eye, `frame` sits outside round / square lenses. */
export const LASHES = {
    near: "M15.3 26.9L13.4 27.2M15.4 25.6L13.6 25.1M16 24.4L14.6 23.2M32.7 26.9L34.6 27.2M32.6 25.6L34.4 25.1M32 24.4L33.4 23.2",
    frame: "M12.7 27.5L10.7 27.9M12.7 25.5L10.7 25.1M13.4 23.6L11.7 22.6M35.3 27.5L37.3 27.9M35.3 25.5L37.3 25.1M34.6 23.6L36.3 22.6",
    width: 1.5
} as const;

/** Cheek blush (two soft ink-tinted ovals) and earrings (two studs under the ears). */
export const BLUSH = { d: "M13.2 33.4h0M34.8 33.4h0", width: 6, opacity: 0.2 } as const;
export const EARRINGS = "M7.5 34.2h0M40.5 34.2h0";
export const EARRING_STYLE = { width: 3.2 } as const;

/**
 * Mouths (shown when there is no mustache). `d` is the outline; `fill` mouths are solid; `teeth` is a white stripe.
 * Mouth 0 is the original smile.
 */
export interface Mouth {
    d: string;
    fill: boolean;
    teeth?: string;
}
export const MOUTHS: readonly Mouth[] = [
    { d: "M19.5 34q4.5 3.5 9 0", fill: false },
    { d: "M18.8 33.2Q24 34.4 29.2 33.2Q28.6 39.2 24 39.2T18.8 33.2z", fill: true, teeth: "M20.4 34.6h7.2" },
    { d: "M20.6 35.6h6.8", fill: false },
    { d: "M24 32.9a2.7 3.1 0 1 0 .01 0z", fill: true },
    { d: "M20.2 35.4q3.6 1.1 7.8-1.8", fill: false }
];

export interface Variant {
    brows: BrowStyle;
    freckles: boolean;
    beard: boolean;
}

/** Variant 0 is the original face. Add new ones at the END: the order decides which index gets which look. */
export const VARIANTS: readonly Variant[] = [
    { brows: "base", freckles: false, beard: false },
    { brows: "arched", freckles: true, beard: false },
    { brows: "thick", freckles: false, beard: true },
    { brows: "angry", freckles: true, beard: false }
];

/** How many different avatars exist: indexes 0 .. AVATAR_COUNT - 1. */
export const AVATAR_COUNT = BASE_AVATARS * VARIANTS.length;

export interface AvatarLook extends Variant {
    /** 0-5: which hat, or NO_HAT (6) for none. */
    hat: number;
    /** 0-2: which skin tone (index into FILLS). */
    skin: number;
    /** True: mustache. False: glasses and a smile. */
    mustache: boolean;
    /** True: the shirt has a tie. */
    tie: boolean;
    /** 0-7: hair style (0 = none, the original). */
    hair: number;
    /** 0-2: hair colour (index into HAIR_FILLS). */
    hairTone: number;
    /** True: eyelashes. */
    lashes: boolean;
    /** True: bold lips. */
    lips: boolean;
    /** True: earrings. */
    earrings: boolean;
    /** True: blush on the cheeks. */
    blush: boolean;
    /** 0-3: clothes (0 = the original shirt). */
    outfit: number;
    /** 0-3: glasses frames (0 = the original round ones; 3 = none). Only drawn when there is no mustache. */
    frames: number;
    /** 0-4: mouth (0 = the original smile). Only drawn when there is no mustache. */
    mouth: number;
}

/** The new features all at their original setting: what every look saved before they existed has. */
export const PLAIN_EXTRAS = { hair: 0, hairTone: 0, lashes: false, lips: false, earrings: false, blush: false, outfit: 0, frames: 0, mouth: 0 } as const;

/** The look of avatar index `a`. Any number is accepted (negative, fractional, too big): it wraps into 0 .. AVATAR_COUNT - 1. */
export function avatarLook(a: number): AvatarLook {
    const i = Number.isFinite(a) ? ((Math.trunc(a) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT : 0;
    return {
        hat: i % 6,
        skin: i % 3,
        mustache: Math.floor(i / 6) % 2 === 1,
        tie: i % 2 === 1,
        ...VARIANTS[Math.floor(i / BASE_AVATARS)],
        ...PLAIN_EXTRAS
    };
}

/**
 * SAVED DATA - the bit layout of `Player.l` (12 bits, 0 .. LOOK_MAX), lowest bit first. Never change it, only document it:
 *   bits 0-2  hat (0-5)
 *   bits 3-4  skin (0-2)
 *   bit  5    mustache (1) or glasses (0)
 *   bit  6    tie
 *   bits 7-9  brows: index into BROW_ORDER (0-4)
 *   bit  10   freckles
 *   bit  11   beard
 * Added later (0 = the original look, so older codes are unchanged):
 *   bits 12-14 hair style (0-7)
 *   bits 15-16 hair tone (0-2)
 *   bit  17    eyelashes
 *   bit  18    lips
 *   bit  19    earrings
 *   bit  20    blush
 *   bits 21-22 clothes (0-3)
 *   bits 23-24 glasses frames (0-3)
 *   bits 25-27 mouth (0-4)
 */
export const LOOK_BITS = {
    hat: 0, skin: 3, mustache: 5, tie: 6, brows: 7, freckles: 10, beard: 11,
    hair: 12, hairTone: 15, lashes: 17, lips: 18, earrings: 19, blush: 20, outfit: 21, frames: 23, mouth: 25
} as const;

/** Number of hats (the 6 original ones and NO_HAT), skin tones, hair styles and tones, clothes, frames and mouths the builder offers. */
export const HAT_COUNT = 7;
/** The hat value that draws no hat. The original looks only use 0-5, so older codes are unchanged. */
export const NO_HAT = 6;
export const SKIN_COUNT = 3;
export const HAIR_COUNT = HAIR.length;
export const HAIR_TONE_COUNT = HAIR_FILLS.length;
export const OUTFIT_COUNT = 4;
export const FRAMES_COUNT = 4;
export const MOUTH_COUNT = MOUTHS.length;

/** SAVED DATA - the order of the eyebrow styles inside a look code. Never reorder it; new styles only go at the END (max 8). */
export const BROW_ORDER: readonly BrowStyle[] = ["base", "arched", "thick", "angry", "flat"];

/**
 * Quick styles of the builder: each gives the parts it changes for the current look (hat, skin, brows, freckles and the like stay).
 * "Classic" puts every extra back to the original. Not saved: a style is just a shortcut to a look.
 */
export const STYLES: readonly ((look: AvatarLook) => Partial<AvatarLook>)[] = [
    () => ({ ...PLAIN_EXTRAS }),
    () => ({ hair: 1, lashes: false, lips: false, earrings: false, blush: false, outfit: 0 }),
    () => ({ hair: 3, lashes: true, lips: true, earrings: true, blush: false, outfit: 1, mustache: false, beard: false, tie: false }),
    () => ({ hair: 2, lashes: false, lips: false, earrings: false, blush: false, outfit: 2, mustache: false, frames: 2 })
];
export const STYLE_COUNT = STYLES.length;

/** The look after quick style `n` (an unknown style changes nothing). */
export function applyStyle(look: AvatarLook, n: number): AvatarLook {
    const style = STYLES[n];
    return style ? { ...look, ...style(look) } : look;
}

/** True when `look` already has everything quick style `n` sets. */
export function hasStyle(look: AvatarLook, n: number): boolean {
    const style = STYLES[n];
    return !!style && Object.entries(style(look)).every(([key, value]) => look[key as keyof AvatarLook] === value);
}

/** Highest valid look code (28 bits). Codes up to 4095 are the ones saved before the hair, clothes and face extras existed. */
export const LOOK_MAX = 268435455;
/** The highest code of the first 12 bits: looks that only use hat, skin, face, tie, brows, freckles and beard. */
export const BASIC_LOOK_MAX = 4095;

/** The default look: avatar 0, and the look of every invalid code. */
export const DEFAULT_LOOK: AvatarLook = avatarLook(0);

/** True for an integer 0 .. LOOK_MAX whose parts are all in range (a code that decodes to a real look). */
export function isLookCode(code: unknown): code is number {
    if (typeof code !== "number" || !Number.isInteger(code) || code < 0 || code > LOOK_MAX) {
        return false;
    }
    return ((code >> LOOK_BITS.hat) & 7) < HAT_COUNT && ((code >> LOOK_BITS.skin) & 3) < SKIN_COUNT && ((code >> LOOK_BITS.brows) & 7) < BROW_ORDER.length
        && ((code >> LOOK_BITS.hair) & 7) < HAIR_COUNT && ((code >> LOOK_BITS.hairTone) & 3) < HAIR_TONE_COUNT && ((code >> LOOK_BITS.outfit) & 3) < OUTFIT_COUNT
        && ((code >> LOOK_BITS.frames) & 3) < FRAMES_COUNT && ((code >> LOOK_BITS.mouth) & 7) < MOUTH_COUNT;
}

/** `value` when it is an integer 0 .. count - 1, else 0. */
const inRange = (value: number, count: number): number => (Number.isInteger(value) && value >= 0 && value < count ? value : 0);

/** Packs a look into its code. Parts out of range are replaced by the default ones, so the result is always valid. */
export function lookToCode(look: AvatarLook): number {
    const hat = inRange(look.hat, HAT_COUNT);
    const skin = inRange(look.skin, SKIN_COUNT);
    const brows = Math.max(0, BROW_ORDER.indexOf(look.brows));
    const bit = (on: boolean, at: number) => (on ? 1 : 0) << at;
    return (hat << LOOK_BITS.hat) | (skin << LOOK_BITS.skin) | bit(look.mustache, LOOK_BITS.mustache) | bit(look.tie, LOOK_BITS.tie)
        | (brows << LOOK_BITS.brows) | bit(look.freckles, LOOK_BITS.freckles) | bit(look.beard, LOOK_BITS.beard)
        | (inRange(look.hair, HAIR_COUNT) << LOOK_BITS.hair) | (inRange(look.hairTone, HAIR_TONE_COUNT) << LOOK_BITS.hairTone)
        | bit(look.lashes, LOOK_BITS.lashes) | bit(look.lips, LOOK_BITS.lips) | bit(look.earrings, LOOK_BITS.earrings) | bit(look.blush, LOOK_BITS.blush)
        | (inRange(look.outfit, OUTFIT_COUNT) << LOOK_BITS.outfit) | (inRange(look.frames, FRAMES_COUNT) << LOOK_BITS.frames)
        | (inRange(look.mouth, MOUTH_COUNT) << LOOK_BITS.mouth);
}

/** The look of a code. Anything that is not a valid code (NaN, fractions, too big, unknown parts) gives the default look; never throws. */
export function codeToLook(code: unknown): AvatarLook {
    if (!isLookCode(code)) {
        return { ...DEFAULT_LOOK };
    }
    return {
        hat: (code >> LOOK_BITS.hat) & 7,
        skin: (code >> LOOK_BITS.skin) & 3,
        mustache: ((code >> LOOK_BITS.mustache) & 1) === 1,
        tie: ((code >> LOOK_BITS.tie) & 1) === 1,
        brows: BROW_ORDER[(code >> LOOK_BITS.brows) & 7],
        freckles: ((code >> LOOK_BITS.freckles) & 1) === 1,
        beard: ((code >> LOOK_BITS.beard) & 1) === 1,
        hair: (code >> LOOK_BITS.hair) & 7,
        hairTone: (code >> LOOK_BITS.hairTone) & 3,
        lashes: ((code >> LOOK_BITS.lashes) & 1) === 1,
        lips: ((code >> LOOK_BITS.lips) & 1) === 1,
        earrings: ((code >> LOOK_BITS.earrings) & 1) === 1,
        blush: ((code >> LOOK_BITS.blush) & 1) === 1,
        outfit: (code >> LOOK_BITS.outfit) & 3,
        frames: (code >> LOOK_BITS.frames) & 3,
        mouth: (code >> LOOK_BITS.mouth) & 7
    };
}

/** The code of legacy avatar index `a` (lossless: codeToLook(indexToCode(a)) equals avatarLook(a) for 0 .. AVATAR_COUNT - 1). */
export const indexToCode = (a: number): number => lookToCode(avatarLook(a));

/** The legacy index (0 .. AVATAR_COUNT - 1) that draws exactly this code, or null when only the builder can make it. */
export function codeToIndex(code: number): number | null {
    for (let a = 0; a < AVATAR_COUNT; a++) {
        if (indexToCode(a) === code) {
            return a;
        }
    }
    return null;
}

/** The legacy index that looks most like `look` (hat, skin, glasses and tie weigh most, in that order): what old code that only knows `a` shows. */
export function closestIndex(look: AvatarLook): number {
    let best = 0;
    let bestScore = -1;
    for (let a = 0; a < AVATAR_COUNT; a++) {
        const o = avatarLook(a);
        const score = (o.hat === look.hat ? 64 : 0) + (o.skin === look.skin ? 16 : 0) + (o.mustache === look.mustache ? 8 : 0) + (o.tie === look.tie ? 4 : 0)
            + (o.brows === look.brows ? 2 : 0) + (o.freckles === look.freckles ? 1 : 0) + (o.beard === look.beard ? 1 : 0);
        if (score > bestScore) {
            best = a;
            bestScore = score;
        }
    }
    return best;
}

/** What a player is drawn with: the builder code `l` when it is valid, else the legacy index `a`. */
export const playerCode = (p: { a: number; l?: number }): number => (isLookCode(p.l) ? p.l : indexToCode(p.a));
export const playerLook = (p: { a: number; l?: number }): AvatarLook => (isLookCode(p.l) ? codeToLook(p.l) : avatarLook(p.a));

/**
 * A random look. Glasses/mustache and tie are coin flips; freckles and a beard are rarer so most faces stay clean. `rng` returns [0, 1).
 * Half of the faces are "feminine" (long or tied hair, lashes, lips, earrings, a blouse; never a beard or a mustache), the rest "masculine"
 * (short hair or none, a shirt). The first seven draws are the original ones, so older seeds still give the same base face.
 */
export function randomLook(rng: () => number = Math.random): AvatarLook {
    const pick = (n: number) => Math.min(n - 1, Math.max(0, Math.floor(rng() * n)));
    const base = {
        hat: pick(HAT_COUNT),
        skin: pick(SKIN_COUNT),
        mustache: rng() < 0.5,
        tie: rng() < 0.5,
        brows: BROW_ORDER[pick(BROW_ORDER.length)],
        freckles: rng() < 0.3,
        beard: rng() < 0.3
    };
    const feminine = rng() >= 0.5;
    const hairs = feminine ? FEMININE_HAIR : MASCULINE_HAIR;
    const hair = hairs[pick(hairs.length)];
    const tone = rng() < 0.7 ? 0 : 1 + pick(HAIR_TONE_COUNT - 1);
    const frames = rng() < 0.7 ? 0 : pick(FRAMES_COUNT);
    const mouth = rng() < 0.6 ? 0 : pick(MOUTH_COUNT);
    const blush = rng() < 0.2;
    if (feminine) {
        return {
            ...base, mustache: false, beard: false, tie: false, hair, hairTone: tone, lashes: rng() < 0.8, lips: rng() < 0.6, earrings: rng() < 0.6,
            blush, outfit: rng() < 0.7 ? 1 : 2 + pick(OUTFIT_COUNT - 2), frames, mouth
        };
    }
    return {
        ...base, hair, hairTone: tone, lashes: false, lips: false, earrings: rng() < 0.1, blush: false, outfit: rng() < 0.8 ? 0 : 2 + pick(OUTFIT_COUNT - 2), frames, mouth
    };
}

/** A random look code that is not in `taken` (the first free code when luck fails; any random code when every code is taken). */
export function randomFreeCode(taken: readonly number[], rng: () => number = Math.random): number {
    const used = new Set(taken);
    for (let n = 0; n < 40; n++) {
        const code = lookToCode(randomLook(rng));
        if (!used.has(code)) {
            return code;
        }
    }
    for (let code = 0; code <= LOOK_MAX; code++) {
        if (isLookCode(code) && !used.has(code)) {
            return code;
        }
    }
    return lookToCode(randomLook(rng));
}
