/**
 * Small DOM animation helpers (bump/pop/shine/shake/spark) and the tap sound.
 */
import { hasWords } from "#lib/data/words/index.ts";
import { locale } from "#lib/i18n/index.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { customWordCount } from "#lib/components/categories/category-ui.ts";
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { hiss } from "#lib/audio/noise.ts";
import { tone } from "#lib/audio/tone.ts";

export const activeCategoryCount = () => state.cats.filter(c => hasWords(c, locale.words)).length + (state.cu && customWordCount() ? 1 : 0);

/**
 * Starts the CSS animation tied to class `c`. Only when the class is already on does it have to be
 * dropped and the reflow forced so the animation starts over; adding it fresh starts it by itself,
 * so the first (usual) call costs no forced layout.
 */
const restart = (el: any, c: string) => {
    if (el.classList.contains(c)) {
        el.classList.remove(c);
        void el.offsetWidth;
    }
    el.classList.add(c);
};

/** True on touch / narrow screens, where styles/performance.css hides the sheen of `.btn.go` and the sparks, so there is nothing to start or build. */
const touchUi = matchMedia("(hover:none),(pointer:coarse),(max-width:820px)");

export const bumpEl = (el?: any) => {
    restart(el, "bump");
};

export const popEl = (el?: any) => {
    restart(el, "pop");
    if (el.classList.contains("go")) {
        shine(el);
    }
};

export function sparkBurst(el?: any) {
    // `.spark` is display:none on touch screens (styles/performance.css): do not build DOM nobody sees.
    if (prefersReducedMotion() || touchUi.matches) {
        return;
    }
    const batch = document.createDocumentFragment(), sparks: HTMLElement[] = [];
    for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, s = document.createElement("i");
        s.className = "spark";
        s.style.setProperty("--dx", Math.round(Math.cos(a) * 40) + "px");
        s.style.setProperty("--dy", Math.round(Math.sin(a) * 40) + "px");
        batch.appendChild(s);
        sparks.push(s);
    }
    el.appendChild(batch);
    setTimeout(() => sparks.forEach(s => s.remove()), 600);
}

export const shine = (el?: any) => {
    if (touchUi.matches) {
        return;
    }
    restart(el, "shine");
};

export const screenShake = () => {
    if (prefersReducedMotion()) {
        return;
    }
    restart(document.getElementById("app"), "shake");
    vibrate(40);
};

export const tapSound = () => {
    hiss(.018, { f: 2200, q: 1.6, v: .05, a: .002 });
    tone(150, .04, { v: .06, a: .002, lp: 500 });
};
