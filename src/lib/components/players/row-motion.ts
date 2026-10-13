/**
 * Enter / exit transitions of a player row in the players sheet (same look as the old
 * `.cr.in` / `.cr.out` keyframes: rowin .45s spring, rowout .2s ease). prefers-reduced-motion: duration 0.
 */
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { bezier } from "#lib/components/ui/sheet-motion.ts";

const spring = bezier(.34, 1.56, .64, 1);
const ease = bezier(.25, .1, .25, 1);

export function rowIn(_node: Element, { duration = 450 }: { duration?: number } = {}) {
    return {
        duration: prefersReducedMotion() ? 0 : duration,
        easing: spring,
        css: (t: number, u: number) => `opacity:${Math.min(1, t * 4)};transform:translateY(${-10 * u}px) scale(${1 - .04 * u})`
    };
}

export function rowOut(_node: Element, { duration = 200 }: { duration?: number } = {}) {
    return {
        duration: prefersReducedMotion() ? 0 : duration,
        easing: ease,
        css: (t: number, u: number) => `opacity:${t};transform:translateX(${30 * u}px) scale(${1 - .04 * u})`
    };
}
