/**
 * Drag-to-dismiss for the bottom sheets, the way native sheets behave: the sheet follows the finger,
 * lets go past a third of its height (or on a quick downward flick) and it slides away; otherwise it
 * springs back. The dim behind it fades with the drag (`--dim` on the scrim, read by `.scrim::before`).
 *
 * Where a drag can start:
 *  - the grabber, the title and the header (`HANDLE`): Pointer Events, so mouse, touch and pen all work
 *    (the CSS gives those elements `touch-action: none`, so the browser does not scroll instead);
 *  - anywhere else on a touch screen, but only downwards and only while the sheet is scrolled to the
 *    top (Touch Events, because a non-passive `touchmove` is the only way to claim a pan that would
 *    otherwise scroll). Buttons, inputs (the volume slider) and `[data-nodrag]` never start a drag.
 *
 * On release past the threshold `close()` is called with the sheet still where the finger left it; the
 * exit transition (`sheetOut` in sheet-motion.ts) reads `data-dy` / `data-vy` and finishes the slide
 * from there, so nothing jumps. Keyboard users keep Escape, the scrim and the "Gata" button.
 */
import { prefersReducedMotion } from "#lib/utils/media.ts";

/** Pixels the pointer must travel before it counts as a drag (keeps taps and scrolls working). */
const SLOP = 6;
/** Fraction of the sheet's height that dismisses it on release. */
const DISTANCE = 0.3;
/** Release speed (px/ms) that dismisses it even when it has not gone far. */
const FLICK = 0.5;
/** How far (px) the sheet may be pulled up past its resting place; the pull is damped. */
const OVERPULL = 24;
const SPRING = "transform .28s cubic-bezier(.22,1,.36,1)";
const HANDLE = ".grab,.shead,#st";
const SKIP = "button,a,input,textarea,select,[data-nodrag]";

type Mode = "idle" | "pending" | "drag";

export function dragToClose(node: HTMLElement, onclose: () => void) {
    const scrim = node.parentElement;
    let close = onclose;
    let mode: Mode = "idle";
    let via: "pointer" | "touch" = "pointer";
    let pid = -1;
    let sx = 0, sy = 0;        // where the gesture started
    let oy = 0;                // where the drag itself started (after the slop), so the sheet does not jump
    let h = 1;                 // sheet height while dragging
    let y = 0;                 // current offset in px
    let vy = 0, lastY = 0, lastT = 0;

    const apply = (v: number) => {
        y = v;
        node.style.transform = `translate3d(0,${v}px,0)`;
        node.dataset.dy = String(Math.max(0, v));
        scrim?.style.setProperty("--dim", String(1 - 0.9 * Math.min(1, Math.max(0, v) / h)));
    };

    const begin = (cy: number) => {
        mode = "drag";
        h = node.offsetHeight || 1;
        oy = cy;
        lastY = cy;
        lastT = performance.now();
        vy = 0;
        node.style.transition = "none";
        node.dataset.drag = "";
        scrim?.setAttribute("data-dragging", "");
    };

    const move = (cy: number) => {
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 0) {
            vy = 0.6 * ((cy - lastY) / dt) + 0.4 * vy;
            lastY = cy;
            lastT = now;
        }
        const raw = cy - oy;
        apply(raw < 0 ? Math.max(-OVERPULL, raw / 6) : raw);
    };

    const reset = () => {
        mode = "idle";
        delete node.dataset.drag;
        scrim?.removeAttribute("data-dragging");
    };

    const springBack = () => {
        scrim?.style.removeProperty("--dim");
        node.dataset.dy = "0";
        if (prefersReducedMotion() || !y) {
            node.style.transition = "";
            node.style.transform = "";
            return;
        }
        node.style.transition = SPRING;
        node.style.transform = "translate3d(0,0,0)";
        const done = (e?: TransitionEvent) => {
            if (e && e.target !== node) {
                return;
            }
            node.removeEventListener("transitionend", done);
            node.style.transition = "";
            node.style.transform = "";
        };
        node.addEventListener("transitionend", done);
    };

    const end = (cancelled: boolean) => {
        if (mode !== "drag") {
            mode = "idle";
            return;
        }
        reset();
        const dismiss = !cancelled && (y > h * DISTANCE || (vy > FLICK && y > 16));
        if (dismiss) {
            node.dataset.vy = String(Math.max(0, vy));
            close();
        }
        else {
            springBack();
        }
    };

    /* Pointer Events: grabber, title, header. */
    const pdown = (e: PointerEvent) => {
        const t = e.target as Element;
        if (mode !== "idle" || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || !t.closest(HANDLE) || t.closest(SKIP)) {
            return;
        }
        mode = "pending";
        via = "pointer";
        pid = e.pointerId;
        sx = e.clientX;
        sy = e.clientY;
        node.setPointerCapture?.(pid);
    };
    const pmove = (e: PointerEvent) => {
        if (via !== "pointer" || e.pointerId !== pid) {
            return;
        }
        if (mode === "pending" && Math.abs(e.clientY - sy) > SLOP && Math.abs(e.clientY - sy) >= Math.abs(e.clientX - sx)) {
            begin(e.clientY);
        }
        if (mode === "drag") {
            move(e.clientY);
        }
    };
    const pup = (e: PointerEvent) => {
        if (via === "pointer" && e.pointerId === pid) {
            end(e.type === "pointercancel");
        }
    };

    /* Touch Events: the body of the sheet, only while it is scrolled to the top. */
    const scrolledAway = (t: Element) => {
        for (let el: Element | null = t; el; el = el.parentElement) {
            if (el.scrollTop > 0) {
                return true;
            }
            if (el === node) {
                break;
            }
        }
        return false;
    };
    const tstart = (e: TouchEvent) => {
        const t = e.target as Element;
        if (mode !== "idle" || e.touches.length !== 1 || t.closest(HANDLE) || t.closest(SKIP) || scrolledAway(t)) {
            return;
        }
        mode = "pending";
        via = "touch";
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
    };
    const tmove = (e: TouchEvent) => {
        if (via !== "touch" || mode === "idle") {
            return;
        }
        const cy = e.touches[0].clientY;
        if (mode === "pending") {
            const dy = cy - sy, dx = e.touches[0].clientX - sx;
            if (dy > SLOP && dy > Math.abs(dx) && node.scrollTop <= 0) {
                begin(cy);
            }
            else if (dy < -SLOP || Math.abs(dx) > SLOP) {
                mode = "idle";   // an upward or sideways gesture: leave it to the page
                return;
            }
        }
        if (mode === "drag") {
            if (e.cancelable) {
                e.preventDefault();
            }
            move(cy);
        }
    };
    const tend = (e: TouchEvent) => {
        if (via === "touch" && mode !== "idle") {
            end(e.type === "touchcancel");
        }
    };

    node.addEventListener("pointerdown", pdown);
    node.addEventListener("pointermove", pmove);
    node.addEventListener("pointerup", pup);
    node.addEventListener("pointercancel", pup);
    node.addEventListener("touchstart", tstart, { passive: true });
    node.addEventListener("touchmove", tmove, { passive: false });
    node.addEventListener("touchend", tend);
    node.addEventListener("touchcancel", tend);

    return {
        update(next: () => void) {
            close = next;
        },
        destroy() {
            node.removeEventListener("pointerdown", pdown);
            node.removeEventListener("pointermove", pmove);
            node.removeEventListener("pointerup", pup);
            node.removeEventListener("pointercancel", pup);
            node.removeEventListener("touchstart", tstart);
            node.removeEventListener("touchmove", tmove);
            node.removeEventListener("touchend", tend);
            node.removeEventListener("touchcancel", tend);
            scrim?.removeAttribute("data-dragging");
            scrim?.style.removeProperty("--dim");
        },
    };
}
