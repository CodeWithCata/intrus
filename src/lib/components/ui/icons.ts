/**
 * Sprite lookup for <Icon> (iconParts) and icon(name), an HTML-string version kept for the intro golden test.
 *
 * The sprite is static, so each symbol is read (and serialized) once and kept. Two versions are kept:
 * `full`, with the symbol's SMIL animations, and `still`, the same icon without them (its resting
 * drawing, exactly what prefers-reduced-motion shows). "Mod telefon slab" (state.lite) gets `still`: SMIL cannot be switched off in CSS, runs on the main thread and
 * repaints every icon on every frame, which is what a weak phone feels as lag. Reading `state.lite`
 * here makes <Icon> follow the switch live. Icons inside a bottom sheet always get `still` (see Sheet.svelte): a sheet is a
 * composited layer, and every SMIL tick of its ~15 icons repainted the whole tall layer.
 */
import { state } from "#lib/stores/settings.svelte.ts";

/** Set to false to keep the icons' idle animations in "Mod telefon slab" too (costs main-thread time). */
export const LITE_STILL_ICONS = true;

const SMIL = "animate,animateTransform,animateMotion,set";

type Parts = { viewBox: string; full: string; still: string };

const sprite = new Map<string, Parts | null>();

const read = (n: string): Parts | null => {
    let p = sprite.get(n);
    if (p !== undefined) {
        return p;
    }
    const e = document.getElementById("i-" + n);
    if (!e) {
        /* not cached: the sprite may not exist yet (tests mount before app.html is in place) */
        return null;
    }
    const full = e.innerHTML, c = e.cloneNode(true) as Element;
    c.querySelectorAll(SMIL).forEach(a => a.remove());
    p = { viewBox: String(e.getAttribute("viewBox")), full, still: c.innerHTML };
    sprite.set(n, p);
    return p;
};

/* prefers-reduced-motion needs no check here: utils/reduced-motion.ts already strips SMIL from the sprite itself. */
const still = () => LITE_STILL_ICONS && !!state.lite;

/** Sprite lookup shared by icon() and <Icon>; null when the symbol is missing. */
export const iconParts = (n?: any, forceStill = false): { viewBox: string; inner: string } | null => {
    const p = read(String(n));
    return p ? { viewBox: p.viewBox, inner: forceStill || still() ? p.still : p.full } : null;
};

export const iconCache = new Map();

export const icon = (n?: any) => {
    const k = n + (still() ? "|s" : "");
    let r = iconCache.get(k);
    if (r !== undefined) {
        return r;
    }
    const p = iconParts(n);
    r = p ? `<svg class="ic" viewBox="${p.viewBox}" aria-hidden="true">${p.inner}</svg>` : `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
    iconCache.set(k, r);
    return r;
};
