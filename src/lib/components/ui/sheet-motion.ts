/**
 * Exit transitions of the bottom sheets (same look as the old .leave keyframes): the scrim fades
 * out in 240 ms, the sheet sinks 60% in 260 ms (or, after being dragged, slides on from where it was let go).
 * prefers-reduced-motion: duration 0.
 */
import { prefersReducedMotion } from "#lib/utils/media.ts";

/** CSS cubic-bezier(x1, y1, x2, y2) as an easing function. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t: number) => ((ax * t + bx) * t + cx) * t;
    const Y = (t: number) => ((ay * t + by) * t + cy) * t;
    return (x: number) => {
        if (x <= 0 || x >= 1) {
            return x;
        }
        let lo = 0, hi = 1, t = x;
        for (let i = 0; i < 24; i++) {
            const v = X(t);
            if (Math.abs(v - x) < 1e-4) {
                break;
            }
            if (v < x) {
                lo = t;
            }
            else {
                hi = t;
            }
            t = (lo + hi) / 2;
        }
        return Y(t);
    };
}

const sinkEase = bezier(.5, 0, .75, 0);

export function scrimOut(_node: Element, { duration = 240 }: { duration?: number } = {}) {
    return { duration: prefersReducedMotion() ? 0 : duration, css: (t: number) => `opacity:${t}` };
}

const dragOutEase = bezier(.2, .7, .4, 1);

/** Sinks the sheet; after a drag (sheet-drag.ts) it finishes the slide from where the finger let go, at the release speed. */
export function sheetOut(node: Element, { duration = 260 }: { duration?: number } = {}) {
    const el = node as HTMLElement;
    const y0 = Math.max(0, parseFloat(el.dataset.dy ?? "0") || 0);
    if (y0 > 0) {
        const h = el.offsetHeight || 1;
        const v = Math.max(parseFloat(el.dataset.vy ?? "0") || 0, 0.8);
        return {
            duration: prefersReducedMotion() ? 0 : Math.min(300, Math.max(120, Math.round((h - y0) / v))),
            easing: dragOutEase,
            css: (_t: number, u: number) => `transform:translate3d(0,${y0 + (h - y0) * u}px,0)`,
        };
    }
    return { duration: prefersReducedMotion() ? 0 : duration, easing: sinkEase, css: (_t: number, u: number) => `transform:translateY(${60 * u}%)` };
}
