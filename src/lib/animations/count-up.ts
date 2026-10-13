/**
 * Animated score count-up.
 */
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { popEl } from "#lib/animations/motion.ts";

export const countUp = () => document.querySelectorAll(".tot").forEach((el, i) => {
    const n = +el.textContent;
    if (!n || prefersReducedMotion()) {
        return;
    }
    const t0 = performance.now() + 300 + i * 70;
    el.textContent = "0";
    const f = (t: number) => {
        const k = Math.min(1, Math.max(0, (t - t0) / 700));
        el.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3))));
        if (k < 1) {
            requestAnimationFrame(f);
        }
        else {
            popEl(el);
        }
    };
    requestAnimationFrame(f);
});
