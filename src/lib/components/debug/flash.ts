/**
 * Flash recorder (the debugger's "Flash" tab). A flash that fps cannot show is almost always one of:
 *   - elements that are re-created (a Svelte re-render), so their entrance animation starts again from opacity 0
 *   - an animation or transition that starts after the tap and begins invisible / half-faded
 *   - a container (#app, .sheet, .scrim, body, html) whose opacity, background or class changes
 *   - a layout shift (something moves a few pixels)
 *   - nothing in the DOM at all: the compositor re-rasterises a layer (will-change, masks, backdrop-filter)
 * Arm it, tap the thing that flashes, and for 1.2 s after every tap it logs all of that with timestamps relative to the tap,
 * then names the likely culprits. Everything is built from textContent, never from HTML strings. Loaded only with ?debug=1.
 */

export interface FlashLine {
    t: number;
    kind: string;
    text: string;
}

export interface FlashCapture {
    id: number;
    clock: string;
    target: string;
    lines: FlashLine[];
    suspects: string[];
    frames: number;
    worst: number;
}

const WINDOW_MS = 1200;
const MAX_LINES = 400;
const MAX_CAPTURES = 12;

/** A short readable name for an element: tag#id.class.class (and its parent, so "button.cat" is told apart). */
export function sel(n: Node | null | undefined): string {
    if (!n) {
        return "?";
    }
    if (!(n instanceof Element)) {
        return n.nodeName.toLowerCase();
    }
    const one = (e: Element) => {
        const cls = [...e.classList].filter(c => !c.startsWith("dbg")).slice(0, 3);
        return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (cls.length ? "." + cls.join(".") : "");
    };
    const p = n.parentElement;
    return p && p !== document.body && p !== document.documentElement ? `${one(p)} > ${one(n)}` : one(n);
}

const cut = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** The computed properties watched on the containers around the tapped element (a change in any of them is visible). */
const WATCH = ["opacity", "visibility", "display", "transform", "backgroundColor", "color", "filter"] as const;

export class FlashRecorder {
    armed = false;
    captures: FlashCapture[] = [];
    onChange: () => void = () => {};
    /** Called when a window opens / closes, so the pill can show it is recording. */
    onRecording: (on: boolean) => void = () => {};
    #stop: (() => void) | null = null;
    #seq = 0;

    arm(): void {
        if (this.armed) {
            return;
        }
        this.armed = true;
        window.addEventListener("pointerdown", this.#down, true);
        this.onChange();
    }

    disarm(): void {
        if (!this.armed) {
            return;
        }
        this.armed = false;
        window.removeEventListener("pointerdown", this.#down, true);
        this.#stop?.();
        this.onChange();
    }

    clear(): void {
        this.captures = [];
        this.onChange();
    }

    #down = (e: PointerEvent): void => {
        const t = e.target;
        if (!(t instanceof Element) || t.closest(".dbgroot")) {
            return;
        }
        this.#stop?.();
        this.#start(t);
    };

    #start(target: Element): void {
        const t0 = performance.now();
        const lines: FlashLine[] = [];
        const add = (kind: string, text: string) => {
            if (lines.length < MAX_LINES) {
                lines.push({ t: performance.now() - t0, kind, text: cut(text, 200) });
            }
        };
        const tile = target.closest(".cat");
        add("tap", `${sel(target)}${tile ? ` (tile "${cut((tile.querySelector(".cn")?.textContent ?? tile.textContent ?? "").trim(), 24)}", pressed ${tile.getAttribute("aria-pressed")})` : ""}`);
        add("state", `screen html.class="${document.documentElement.className}" body.class="${document.body.className}"`);
        this.onRecording(true);

        // ---- what is watched frame by frame ----
        const chain = [...new Set([tile, target, target.closest(".sheet"), target.closest(".scrim"), document.getElementById("app"), document.querySelector(".bgart"), document.body, document.documentElement])].filter((x): x is Element => !!x);
        const prev = new Map<Element, Record<string, string>>();
        const read = (el: Element) => {
            const cs = getComputedStyle(el);
            const o: Record<string, string> = {};
            for (const p of WATCH) {
                o[p] = String(cs[p]);
            }
            return o;
        };
        chain.forEach(el => prev.set(el, read(el)));

        let frames = 0;
        let worst = 0;
        let last = performance.now();
        let raf = 0;
        let ended = false;
        const frame = (now: number) => {
            if (ended) {
                return;
            }
            const dt = now - last;
            last = now;
            frames++;
            worst = Math.max(worst, dt);
            if (dt > 24) {
                add("jank", `frame took ${dt.toFixed(0)} ms`);
            }
            for (const el of chain) {
                const before = prev.get(el)!;
                const after = read(el);
                for (const p of WATCH) {
                    if (before[p] !== after[p]) {
                        add("style", `${sel(el)} ${p}: ${cut(before[p], 40)} -> ${cut(after[p], 40)}`);
                    }
                }
                prev.set(el, after);
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        // ---- DOM changes ----
        const perAttr = new Map<string, number>();
        const mo = new MutationObserver(list => {
            for (const m of list) {
                const el = m.target instanceof Element ? m.target : m.target.parentElement;
                if (el?.closest(".dbgroot") || el?.closest("#dbg-features")) {
                    continue;
                }
                if (m.type === "attributes") {
                    const key = sel(m.target) + "@" + m.attributeName;
                    const n = (perAttr.get(key) ?? 0) + 1;
                    perAttr.set(key, n);
                    if (n <= 4) {
                        const now = (m.target as Element).getAttribute(m.attributeName!);
                        add("attr", `${sel(m.target)} ${m.attributeName}: "${cut(m.oldValue ?? "", 50)}" -> "${cut(now ?? "(removed)", 50)}"`);
                    }
                    else if (n === 5) {
                        add("attr", `${key} keeps changing (more not shown)`);
                    }
                }
                else if (m.type === "childList") {
                    for (const n of m.addedNodes) {
                        if (n instanceof Element && !n.closest(".dbgroot")) {
                            add("added", `${sel(n)} (+${n.querySelectorAll("*").length} inside)`);
                        }
                    }
                    for (const n of m.removedNodes) {
                        if (n instanceof Element && !n.closest(".dbgroot")) {
                            add("removed", `${sel(n)} (-${n.querySelectorAll("*").length} inside)`);
                        }
                    }
                }
            }
        });
        mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true });

        // ---- animations and transitions ----
        const props = (e: Event) => {
            const ev = e as AnimationEvent;
            try {
                const a = (e.target as Element).getAnimations().find(x => (x as CSSAnimation).animationName === ev.animationName);
                const frames2 = (a?.effect as KeyframeEffect | undefined)?.getKeyframes() ?? [];
                const names = new Set<string>();
                frames2.forEach(k => Object.keys(k).forEach(p => !["offset", "easing", "composite", "computedOffset"].includes(p) && names.add(p)));
                return [...names].join(",");
            }
            catch {
                return "";
            }
        };
        const onAnim = (e: Event) => {
            const t = e.target as Element;
            if (t?.closest?.(".dbgroot") || t?.closest?.(".bgart")) {
                return;
            }
            const ae = e as AnimationEvent;
            const te = e as TransitionEvent;
            if (e.type.startsWith("animation")) {
                add(e.type, `${ae.animationName} on ${sel(t)}${ae.pseudoElement ? ae.pseudoElement : ""}${e.type === "animationstart" ? " [" + props(e) + "]" : ""}`);
            }
            else {
                add(e.type, `${te.propertyName} on ${sel(t)}${te.pseudoElement ? te.pseudoElement : ""}`);
            }
        };
        const evs = ["animationstart", "animationend", "animationcancel", "transitionrun", "transitionstart", "transitioncancel"];
        evs.forEach(n => document.addEventListener(n, onAnim, true));

        /* Animations that are created but still waiting out their delay show no event yet, yet the element is already invisible (backwards fill). */
        const snap = (label: string) => {
            try {
                for (const a of document.getAnimations()) {
                    const eff = a.effect as KeyframeEffect | null;
                    const tm = eff?.getComputedTiming();
                    const tg = eff?.target;
                    if (!eff || !tm || !tg || (tm.iterations ?? 1) === Infinity || tg.closest?.(".dbgroot") || tg.closest?.(".bgart")) {
                        continue;
                    }
                    const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? "?";
                    const kf = new Set<string>();
                    eff.getKeyframes().forEach(k => Object.keys(k).forEach(p => !["offset", "easing", "composite", "computedOffset"].includes(p) && kf.add(p)));
                    add("running", `${label}: ${name} on ${sel(tg)} delay ${Math.round(Number(tm.delay))} ms, ${Math.round(Number(tm.duration))} ms, ${a.playState} [${[...kf].join(",")}]`);
                }
            }
            catch {
                // getAnimations is missing on very old browsers
            }
        };
        const snaps = [setTimeout(() => snap("@40ms"), 40), setTimeout(() => snap("@250ms"), 250)];

        // ---- layout shifts ----
        let po: PerformanceObserver | null = null;
        try {
            po = new PerformanceObserver(list => {
                for (const en of list.getEntries() as unknown as { value: number; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }[]) {
                    const src = (en.sources ?? []).slice(0, 3).map(s => `${sel(s.node)} y ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h ${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`);
                    add("shift", `layout shift ${en.value.toFixed(4)}: ${src.join("; ")}`);
                }
            });
            po.observe({ type: "layout-shift", buffered: false });
        }
        catch {
            po = null; // not supported (iOS Safari)
        }

        const timer = setTimeout(() => this.#finish(), WINDOW_MS);
        const finish = (): void => {
            if (ended) {
                return;
            }
            ended = true;
            clearTimeout(timer);
            snaps.forEach(clearTimeout);
            cancelAnimationFrame(raf);
            mo.disconnect();
            po?.disconnect();
            evs.forEach(n => document.removeEventListener(n, onAnim, true));
            this.#stop = null;
            this.onRecording(false);
            const cap: FlashCapture = {
                id: ++this.#seq,
                clock: new Date().toLocaleTimeString(),
                target: sel(target),
                lines,
                suspects: analyse(lines, !!po),
                frames,
                worst
            };
            this.captures.unshift(cap);
            this.captures.length = Math.min(this.captures.length, MAX_CAPTURES);
            this.onChange();
        };
        this.#finish = finish;
        this.#stop = finish;
    }

    #finish: () => void = () => {};

    /** All captures as plain text, for "Copy flash log" and the main report. */
    toText(): string {
        if (!this.captures.length) {
            return "No flash captures yet.";
        }
        const out: string[] = [];
        for (const c of [...this.captures].reverse()) {
            out.push(`### capture #${c.id} ${c.clock} tapped ${c.target}, ${c.frames} frames, worst ${c.worst.toFixed(0)} ms`);
            out.push(c.suspects.length ? c.suspects.map(s => "SUSPECT: " + s).join("\n") : "SUSPECT: none found");
            for (const l of c.lines) {
                out.push(`${l.t.toFixed(0).padStart(5)} ms  ${l.kind.padEnd(15)} ${l.text}`);
            }
            out.push("");
        }
        return out.join("\n");
    }
}

/** Turns the raw log of one tap into plain-language suspects. */
export function analyse(lines: FlashLine[], shiftSupported: boolean): string[] {
    const s: string[] = [];
    const has = (k: string) => lines.filter(l => l.kind === k);

    const remount = [...has("added"), ...has("removed")].filter(l => /\.cat\b|\.cats\b|\.sheet\b|\.screen\b|\.scrim\b|\.sum\b|#app/.test(l.text));
    if (remount.length) {
        s.push(`Elements were REMOVED / RE-CREATED after the tap (${remount.slice(0, 3).map(l => l.text).join("; ")}${remount.length > 3 ? "; ..." : ""}). A re-created element plays its entrance animation again from opacity 0: this is the classic flash. Find what re-renders it (a {#key}, an {#each} without a key, or a state read that wraps the whole list).`);
    }

    const starts = has("animationstart").filter(l => /\bopacity\b/.test(l.text));
    if (starts.length) {
        s.push(`An animation that starts from opacity 0 ran after the tap: ${starts.slice(0, 3).map(l => l.text).join("; ")}. Anything that is hidden for a moment and then fades in reads as a flash.`);
    }
    const delayed = has("running").filter(l => /\bopacity\b/.test(l.text));
    if (delayed.length) {
        s.push(`Animations on opacity were waiting / running ${delayed[0].text.slice(0, 7)} after the tap: ${[...new Set(delayed.map(l => l.text.replace(/^@\d+ms: /, "")))].slice(0, 3).join("; ")}.`);
    }

    const page = has("style").filter(l => /^(html|body|#app|div#app|\S+ > #app|.*\.scrim|.*\.sheet|.*\.bgart)/.test(l.text) && /opacity|visibility|display|backgroundColor|filter/.test(l.text));
    if (page.length) {
        s.push(`A big container changed look: ${page.slice(0, 3).map(l => l.text).join("; ")}. A page-level opacity or background change flashes the whole screen.`);
    }
    const tileStyle = has("style").filter(l => /\.cat\b/.test(l.text) && /opacity|visibility/.test(l.text));
    if (tileStyle.length) {
        s.push(`The tile itself went transparent or hidden: ${tileStyle.slice(0, 3).map(l => l.text).join("; ")}.`);
    }

    const cls = has("attr").filter(l => /^(html|body)\b.* class:/.test(l.text) || (/\.scrim|\.sheet/.test(l.text) && / class:/.test(l.text)));
    if (cls.length) {
        s.push(`Classes on the root / sheet changed: ${cls.slice(0, 3).map(l => l.text).join("; ")}. CSS rules keyed on these (sheetopen, lite, noswap, leave) restyle everything at once.`);
    }

    const shifts = has("shift");
    if (shifts.length) {
        s.push(`Layout shift: ${shifts.slice(0, 2).map(l => l.text).join("; ")}. Content moved: the page jumps for a frame.`);
    }
    else if (!shiftSupported) {
        s.push("Layout shifts cannot be measured on this browser (iOS Safari), so a shift is not ruled out: watch whether anything jumps.");
    }

    const trans = has("transitionrun");
    if (trans.length >= 3) {
        const names = [...new Set(trans.map(l => l.text.split(" on ")[0]))];
        s.push(`${trans.length} transitions started (${names.join(", ")}). Colour, shadow and background fading in separate steps can show a half-grey flash.`);
    }

    const jank = has("jank");
    if (jank.length) {
        s.push(`${jank.length} slow frame(s) right after the tap (${jank.slice(0, 3).map(l => l.text).join(", ")}): a stall can show as a stutter or a blank frame.`);
    }

    if (!s.length) {
        s.push("Nothing visible changed in the DOM, the styles or the animations after this tap. The flash is probably GPU / compositor level: a layer being re-rasterised (will-change, mask-image, backdrop-filter, mix-blend-mode). Try the Switches tab: 'Forced GPU layers', 'Masks', 'backdrop-filter blur', 'Blend modes', and tap again.");
    }
    return s;
}
