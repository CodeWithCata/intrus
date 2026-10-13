/**
 * Confetti burst.
 */
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { vibrate } from "#lib/audio/haptics.ts";

export const confetti = (n = 40) => {
    if (prefersReducedMotion()) {
        return;
    }
    if (state.lite) {
        n = 12;
    }
    const cs0 = getComputedStyle(document.documentElement), cv = (k: string, d: string) => cs0.getPropertyValue(k).trim() || d, cols = [cv("--ink", "#111114"), state.acc, cv("--grey", "#5C5C66"), cv("--line", "#D9D9DF")];
    // One batched insertion (one style recalculation) and one cleanup timer instead of n of each.
    const batch = document.createDocumentFragment(), pieces: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
        const c = document.createElement("i"), a = (Math.random() - .5) * Math.PI * .9 - Math.PI / 2, v = 240 + Math.random() * 300;
        c.className = "cf";
        c.style.cssText = `left:50%;top:36%;background:${cols[i % 4]};border-radius:${i % 3 ? "2px" : "50%"};--dx:${Math.cos(a) * v | 0}px;--dy:${Math.sin(a) * v | 0}px;--r:${Math.random() * 720 - 360 | 0}deg;--s:${(.7 + Math.random() * .8).toFixed(2)};animation-delay:${i * 8}ms`;
        batch.appendChild(c);
        pieces.push(c);
    }
    document.body.appendChild(batch);
    setTimeout(() => pieces.forEach(c => c.remove()), 1800);
    vibrate([30, 40, 30]);
};
