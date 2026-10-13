/**
 * DOM inspectors of the performance debugger: what is animating (and at what cost), and which elements
 * use expensive CSS. Both only read the page and run on demand, never in the background.
 */
import { COST_RANK, classifyProps, describeNode, kebab, maxFilterBlur, maxShadowBlur, type AnimInfo, type AuditResult, type ImageInfo, type Suspect } from "./stats.ts";

interface AnimLike extends Animation {
    animationName?: string;
    transitionProperty?: string;
}

const KEYFRAME_META = new Set(["offset", "computedOffset", "easing", "composite"]);

function isVisible(el: Element): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
}

/** Every running Web Animation / CSS animation / CSS transition, grouped by name, with the cost class of what it animates. */
export function inspectAnimations(): AnimInfo[] {
    const rows = new Map<string, AnimInfo>();
    let rects = 0;
    for (const a of document.getAnimations() as AnimLike[]) {
        const eff = a.effect as KeyframeEffect | null;
        const type = a.animationName !== undefined ? "animation" : a.transitionProperty !== undefined ? "transition" : "script";
        const name = a.animationName ?? a.transitionProperty ?? (a.id || "element.animate()");
        const key = type + ":" + name;
        let row = rows.get(key);
        if (!row) {
            row = { key, type, name, count: 0, running: 0, infinite: false, props: [], cost: "cheap", offscreen: 0, sample: "", killable: type === "animation" };
            rows.set(key, row);
        }
        row.count++;
        const running = a.playState === "running";
        if (running) {
            row.running++;
        }
        try {
            if (eff?.getComputedTiming().iterations === Infinity) {
                row.infinite = true;
            }
            if (!row.props.length) {
                const props = type === "transition" ? [a.transitionProperty ?? ""] : [...new Set((eff?.getKeyframes() ?? []).flatMap(k => Object.keys(k)).filter(k => !KEYFRAME_META.has(k)))].map(kebab);
                row.props = props.filter(Boolean);
                row.cost = classifyProps(row.props);
            }
        }
        catch {
            /* the target went away between getAnimations() and now */
        }
        const target = eff?.target;
        if (target) {
            if (!row.sample) {
                row.sample = describeNode(target) + (eff?.pseudoElement ?? "");
            }
            if (running && rects < 400) {
                rects++;
                if (!isVisible(target)) {
                    row.offscreen++;
                }
            }
        }
    }
    return [...rows.values()].sort((x, y) => COST_RANK[y.cost] - COST_RANK[x.cost] || y.running - x.running || y.count - x.count);
}

/* ---------- page audit ---------- */

const yieldToUi = () => new Promise<void>(r => setTimeout(r, 0));
const SMIL = "animate,animateTransform,animateMotion,set";

interface Flags {
    weight: number;
    why: string[];
    wc: boolean;
    bd: boolean;
    blur: boolean;
    blend: boolean;
    mask: boolean;
    shadow: boolean;
    fixed: boolean;
    backface: boolean;
}

function flagsOf(cs: CSSStyleDeclaration): Flags {
    const f: Flags = { weight: 0, why: [], wc: false, bd: false, blur: false, blend: false, mask: false, shadow: false, fixed: false, backface: false };
    const bd = cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter");
    if (bd && bd !== "none") {
        f.bd = true;
        f.weight += 5;
        f.why.push("backdrop-filter " + bd.slice(0, 24));
    }
    const filt = cs.filter;
    const fb = maxFilterBlur(filt);
    if (filt && filt !== "none") {
        f.blur = fb > 0;
        f.weight += fb > 0 ? 4 + Math.min(fb / 10, 2) : 1;
        f.why.push("filter " + filt.slice(0, 24));
    }
    if (cs.mixBlendMode !== "normal") {
        f.blend = true;
        f.weight += 4;
        f.why.push("mix-blend-mode " + cs.mixBlendMode);
    }
    const mask = cs.getPropertyValue("mask-image") || cs.getPropertyValue("-webkit-mask-image");
    if (mask && mask !== "none") {
        f.mask = true;
        f.weight += 3;
        f.why.push("mask-image");
    }
    const sb = Math.max(maxShadowBlur(cs.boxShadow), maxShadowBlur(cs.textShadow));
    if (sb >= 12) {
        f.shadow = true;
        f.weight += sb >= 24 ? 3 : 2;
        f.why.push(`shadow blur ${Math.round(sb)}px`);
    }
    if (cs.willChange !== "auto") {
        f.wc = true;
        f.weight += 1.5;
        f.why.push("will-change " + cs.willChange);
    }
    if (cs.backfaceVisibility === "hidden") {
        f.backface = true;
        f.weight += 1;
        f.why.push("backface-visibility");
    }
    if (cs.position === "fixed") {
        f.fixed = true;
    }
    return f;
}

/** Median of a few forced full-page style recalculations + layouts, ms. */
function styleRecalcProbe(): number {
    const root = document.documentElement;
    const st = document.createElement("style");
    st.textContent = "html.dbg-probe *{outline-color:rgba(0,0,0,.004)}";
    document.head.append(st);
    const times: number[] = [];
    try {
        void document.body.offsetHeight;
        for (let i = 0; i < 5; i++) {
            root.classList.toggle("dbg-probe");
            const t0 = performance.now();
            void document.body.offsetHeight;
            times.push(performance.now() - t0);
        }
    }
    finally {
        root.classList.remove("dbg-probe");
        st.remove();
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)] ?? 0;
}

/** Scans the page for expensive CSS, SVG animation, heavy images and the cost of a full style pass. `skip` is the debugger's own root. */
export async function auditPage(skip: Element | null, limit = 5000): Promise<AuditResult> {
    const all = document.getElementsByTagName("*");
    const total = all.length;
    const vArea = Math.max(1, innerWidth * innerHeight);
    const counts = { willChange: 0, backdrop: 0, blur: 0, shadow: 0, blend: 0, mask: 0, fixed: 0, backface: 0 };
    const groups = new Map<string, Suspect>();
    let depth = 0;
    let scanned = 0;
    let rects = 0;

    const note = (sel: string, f: Flags, el: Element) => {
        counts.willChange += +f.wc;
        counts.backdrop += +f.bd;
        counts.blur += +f.blur;
        counts.shadow += +f.shadow;
        counts.blend += +f.blend;
        counts.mask += +f.mask;
        counts.fixed += +f.fixed;
        counts.backface += +f.backface;
        if (f.weight < 2) {
            return;
        }
        let area = 0.3;
        if (rects < 400) {
            rects++;
            const r = el.getBoundingClientRect();
            area = 0.3 + 0.7 * Math.min(1, (r.width * r.height) / vArea);
        }
        const why = f.why.join(", ");
        const key = sel + "|" + why;
        const g = groups.get(key);
        const score = f.weight * area;
        if (g) {
            g.n++;
            g.score = Math.max(g.score, score) + 0.05;
        }
        else {
            groups.set(key, { sel, why, n: 1, score });
        }
    };

    for (let i = 0; i < total && scanned < limit; i++) {
        const el = all[i];
        if (skip && (el === skip || skip.contains(el))) {
            continue;
        }
        scanned++;
        if (!el.firstElementChild) {
            let d = 0;
            for (let p: Node | null = el; p; p = p.parentNode) {
                d++;
            }
            depth = Math.max(depth, d - 1);
        }
        const cs = getComputedStyle(el);
        if (cs.display === "none") {
            continue;
        }
        const f = flagsOf(cs);
        if (f.weight > 0 || f.fixed) {
            note(describeNode(el), f, el);
        }
        for (const pseudo of ["::before", "::after"] as const) {
            const pcs = getComputedStyle(el, pseudo);
            if (pcs.content === "none" || pcs.content === "normal" || pcs.display === "none") {
                continue;
            }
            const pf = flagsOf(pcs);
            if (pf.weight > 0) {
                note(describeNode(el) + pseudo, pf, el);
            }
        }
        if (scanned % 250 === 0) {
            await yieldToUi();
        }
    }

    const sprite = document.querySelector("svg.sprite");
    const spriteSmil = sprite ? sprite.querySelectorAll(SMIL).length : 0;
    const smil = document.querySelectorAll(SMIL).length - spriteSmil;
    const svgNodes = document.querySelectorAll("svg *").length - (sprite ? sprite.querySelectorAll("*").length : 0);
    const svgFilters = document.querySelectorAll("feGaussianBlur,feTurbulence,feDisplacementMap,feMorphology,feConvolveMatrix,feDropShadow").length;

    const dpr = devicePixelRatio || 1;
    const images: ImageInfo[] = [];
    let imageMb = 0;
    for (const img of Array.from(document.images)) {
        if (!img.complete || !img.naturalWidth) {
            continue;
        }
        const mb = (img.naturalWidth * img.naturalHeight * 4) / 1e6;
        imageMb += mb;
        const r = img.getBoundingClientRect();
        const drawn = Math.max(1, r.width * dpr * r.height * dpr);
        images.push({ src: (img.currentSrc || img.src).split("/").slice(-1)[0].slice(0, 40), mb, oversize: (img.naturalWidth * img.naturalHeight) / drawn });
    }
    images.sort((a, b) => b.mb - a.mb);

    await yieldToUi();
    return {
        at: Date.now(),
        dom: total,
        scanned,
        depth,
        counts,
        svgNodes,
        smil,
        svgFilters,
        suspects: [...groups.values()].sort((a, b) => b.score - a.score).slice(0, 12),
        images: images.slice(0, 5),
        imageMb,
        styleMs: styleRecalcProbe()
    };
}
