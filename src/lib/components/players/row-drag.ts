/**
 * Drag to reorder the rows of the players sheet (the order is the order the phone is passed in).
 * Put `use:rowDrag` on the row's grip button. Pointer Events, so mouse, touch and pen all work; the grip has
 * `touch-action: none` (sheets.css) so a finger moves the row instead of scrolling the list. While dragging, the row
 * follows the pointer, the others slide aside to make room, and the list scrolls by itself near its top and bottom edge.
 * On release the row glides into its slot and `onmove(from, to)` is called once; nothing in the data changes before that.
 * Rows may have different heights (a row with a title field is taller), so slots are measured, not computed.
 * Keyboard: ArrowUp / ArrowDown on the focused grip moves the player one place (`kbd` is true).
 */
import { flushSync } from "svelte";
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { beep } from "#lib/audio/tone.ts";

export interface RowDragOptions {
    /** This row's current position in the list (it changes after every move, so pass the live value). */
    index: number;
    /** How many players there are. A drag is ignored while a removed row is still on its way out. */
    count: number;
    /** Called once when the player at `from` should go to `to`. */
    onmove: (from: number, to: number, kbd: boolean) => void;
}

/** Pixels the pointer must travel before a press becomes a drag. */
const SLOP = 4;
/** Distance (px) from the list's top / bottom edge where it starts to scroll, and the fastest scroll (px per frame). */
const EDGE = 56;
const MAX_SCROLL = 14;
const SHIFT = "transform .22s cubic-bezier(.22,1,.36,1), box-shadow .2s";
const GLIDE_MS = 180;
const GLIDE = `transform ${GLIDE_MS}ms cubic-bezier(.22,1,.36,1), box-shadow .2s`;

type Mode = "idle" | "pending" | "drag";

export function rowDrag(node: HTMLElement, options: RowDragOptions) {
    let opts = options;
    let mode: Mode = "idle";
    let busy = false; // the dropped row is still gliding into its slot
    let pid = -1;
    let list: HTMLElement | null = null;
    let scroller: HTMLElement | null = null;
    let rows: HTMLElement[] = [];
    let tops: number[] = []; // row tops relative to the list, measured at pickup
    let hs: number[] = []; // row heights
    let gap = 0;
    let from = -1;
    let to = -1;
    let startY = 0; // pointer position inside the list at pickup
    let sy = 0; // clientY at pointer down (for the slop)
    let pointerY = 0;
    let raf = 0;
    let timer = 0;

    const measure = () => {
        if (!list) {
            return;
        }
        const lt = list.getBoundingClientRect().top;
        const rects = rows.map((r) => r.getBoundingClientRect());
        tops = rects.map((r) => r.top - lt);
        hs = rects.map((r) => r.height);
        gap = parseFloat(getComputedStyle(list).rowGap) || 0;
        startY = pointerY - lt;
    };

    /** Puts the dragged row under the pointer, works out which slot it is over and slides the other rows aside. */
    const place = () => {
        if (!list) {
            return;
        }
        const last = rows.length - 1;
        const lt = list.getBoundingClientRect().top;
        const dy = Math.min(tops[last] + hs[last] - hs[from] - tops[from], Math.max(tops[0] - tops[from], pointerY - lt - startY));
        const center = tops[from] + dy + hs[from] / 2;
        let k = 0;
        for (let j = 0; j < rows.length; j++) {
            if (j !== from && tops[j] + hs[j] / 2 < center) {
                k++;
            }
        }
        if (k !== to) {
            to = k;
            vibrate(6);
        }
        rows.forEach((r, j) => {
            if (j === from) {
                r.style.transform = `translate3d(0,${dy}px,0) scale(1.02)`;
            }
            else if (from < j && j <= to) {
                r.style.transform = `translate3d(0,${-(hs[from] + gap)}px,0)`;
            }
            else if (to <= j && j < from) {
                r.style.transform = `translate3d(0,${hs[from] + gap}px,0)`;
            }
            else {
                r.style.transform = "";
            }
        });
    };

    const loop = () => {
        raf = requestAnimationFrame(loop);
        if (scroller) {
            const r = scroller.getBoundingClientRect();
            const up = r.top + EDGE - pointerY;
            const down = pointerY - (r.bottom - EDGE);
            if (up > 0) {
                scroller.scrollTop -= Math.min(1, up / EDGE) * MAX_SCROLL;
            }
            else if (down > 0) {
                scroller.scrollTop += Math.min(1, down / EDGE) * MAX_SCROLL;
            }
        }
        place();
    };

    const begin = () => {
        if (!list) {
            return;
        }
        measure(); // again: the on-screen keyboard may have closed since the press
        mode = "drag";
        const calm = prefersReducedMotion();
        list.classList.add("sorting");
        rows.forEach((r, j) => {
            r.style.willChange = "transform";
            r.style.transition = j === from || calm ? "none" : SHIFT;
        });
        rows[from].classList.add("dragging");
        vibrate(10);
        loop();
    };

    const commit = (target: number) => {
        rows.forEach((r) => {
            r.style.transition = "none";
            r.style.transform = "";
            r.style.willChange = "";
        });
        list?.classList.remove("sorting");
        if (target !== from) {
            opts.onmove(from, target, false);
            beep(620, .05);
            vibrate(12);
        }
        // Reorder the DOM now, while transitions are off, so the rows do not flash back to their old places first.
        flushSync();
        requestAnimationFrame(() => {
            rows.forEach((r) => {
                r.style.transition = "";
            });
            busy = false;
        });
    };

    const finish = (cancelled: boolean) => {
        cancelAnimationFrame(raf);
        if (pid >= 0) {
            try {
                node.releasePointerCapture(pid);
            }
            catch {
                // already released: nothing to do
            }
        }
        pid = -1;
        const was = mode;
        mode = "idle";
        if (was !== "drag") {
            return;
        }
        const target = cancelled ? from : to;
        const calm = prefersReducedMotion();
        // Where the dragged row's own slot is, relative to where it started.
        const home = (target === from ? tops[from] : target > from ? tops[target] + hs[target] - hs[from] : tops[target]) - tops[from];
        const dragged = rows[from];
        dragged.classList.remove("dragging");
        dragged.style.transition = calm ? "none" : GLIDE;
        dragged.style.transform = `translate3d(0,${home}px,0)`;
        if (cancelled) {
            rows.forEach((r, j) => {
                if (j !== from) {
                    r.style.transform = "";
                }
            });
        }
        busy = true;
        timer = window.setTimeout(() => commit(target), calm ? 0 : GLIDE_MS + 10);
    };

    const down = (e: PointerEvent) => {
        if (busy || mode !== "idle" || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) {
            return;
        }
        const row = node.closest<HTMLElement>(".cr");
        list = row?.parentElement ?? null;
        if (!row || !list) {
            return;
        }
        rows = Array.from(list.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("cr"));
        from = opts.index;
        if (rows.length !== opts.count || rows[from] !== row) {
            return;
        }
        if (e.pointerType === "mouse") {
            e.preventDefault(); // no text selection while dragging with a mouse
        }
        scroller = list.closest<HTMLElement>(".plscroll");
        sy = pointerY = e.clientY;
        to = from;
        pid = e.pointerId;
        measure();
        mode = "pending";
        node.setPointerCapture(pid);
    };

    const move = (e: PointerEvent) => {
        if (e.pointerId !== pid) {
            return;
        }
        pointerY = e.clientY;
        if (mode === "pending" && Math.abs(pointerY - sy) > SLOP) {
            begin();
        }
    };

    const up = (e: PointerEvent) => {
        if (e.pointerId === pid) {
            finish(e.type === "pointercancel");
        }
    };

    const key = (e: KeyboardEvent) => {
        const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        if (!d || busy || mode !== "idle") {
            return;
        }
        e.preventDefault();
        const next = opts.index + d;
        if (next >= 0 && next < opts.count) {
            opts.onmove(opts.index, next, true);
        }
    };

    // A long press on a touch screen must not open the browser's context menu in the middle of a drag.
    const menu = (e: Event) => e.preventDefault();

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("keydown", key);
    node.addEventListener("contextmenu", menu);

    return {
        update(next: RowDragOptions) {
            opts = next;
        },
        destroy() {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
            node.removeEventListener("pointerdown", down);
            node.removeEventListener("pointermove", move);
            node.removeEventListener("pointerup", up);
            node.removeEventListener("pointercancel", up);
            node.removeEventListener("keydown", key);
            node.removeEventListener("contextmenu", menu);
        }
    };
}
