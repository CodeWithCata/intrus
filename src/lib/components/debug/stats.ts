/**
 * Pure helpers of the performance debugger: frame-time maths, formatting, CSS classification and the
 * diagnosis rules. No DOM and no app imports, so everything here is unit-tested (tests/unit/debug.test.ts).
 * The whole debug folder is a lazy chunk, loaded only with ?debug=1 (see boot.ts).
 */

/* ---------- frame maths (shared with the player-facing lite-mode hint) ---------- */

import { FRAME_BUDGETS, LATE_FACTOR, percentile, snapBudget, summarizeFrames, type FrameSummary } from "#lib/utils/frame-stats.ts";

export { FRAME_BUDGETS, LATE_FACTOR, percentile, snapBudget, summarizeFrames, type FrameSummary };

/** Health of a live reading: drives the colour of the pill and the numbers. */
export type Health = "ok" | "warn" | "bad";

export function healthOf(s: FrameSummary, budget: number): Health {
    if (!s.frames) {
        return "ok";
    }
    if (s.lateRatio > 0.1 || s.fps < (1000 / budget) * 0.7) {
        return "bad";
    }
    if (s.lateRatio > 0.02 || s.fps < (1000 / budget) * 0.9 || s.worst > budget * 5) {
        return "warn";
    }
    return "ok";
}

/* ---------- formatting ---------- */

export const fmt = (n: number, digits = 1): string => (Number.isFinite(n) ? n.toFixed(digits) : "-");

/** "3 s ago", "2 min ago". */
export function ago(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 90 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

/** Short, stable description of a node for logs: tag#id.class.class (debug and framework classes dropped). */
export function describeNode(node: Node | null | undefined): string {
    const el: Element | null = !node ? null : node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (!el) {
        return "(detached)";
    }
    const id = el.id ? "#" + el.id : "";
    const cls = (el.getAttribute("class") || "")
        .split(/\s+/)
        .filter(c => c && !/^(dbg|svelte-)/.test(c))
        .slice(0, 2)
        .map(c => "." + c)
        .join("");
    return (el.localName + id + cls).slice(0, 60);
}

/** Last path segment of a script URL, without query: "chunks/abc.js". */
export function shortUrl(url: string | undefined): string {
    if (!url) {
        return "";
    }
    try {
        const u = new URL(url, "http://x");
        const parts = u.pathname.split("/").filter(Boolean);
        return parts.slice(-1)[0] ?? "";
    }
    catch {
        return url.slice(-40);
    }
}

/* ---------- CSS classification ---------- */

/** What an animated property costs: cheap = compositor only, gpu = filter-like, paint = repaint each frame, layout = reflow each frame. */
export type AnimCost = "cheap" | "gpu" | "paint" | "layout";
export const COST_RANK: Record<AnimCost, number> = { cheap: 0, gpu: 1, paint: 2, layout: 3 };

const CHEAP = new Set(["transform", "opacity", "translate", "rotate", "scale", "offset-distance", "offset-rotate", "offset-path"]);
const GPU = new Set(["filter", "backdrop-filter", "-webkit-backdrop-filter"]);
const LAYOUT = /^(width|height|min-|max-|top$|left$|right$|bottom$|inset|margin|padding|border(-top|-right|-bottom|-left)?-width|font-size|line-height|letter-spacing|word-spacing|flex|grid|gap|display|position|float|columns|aspect-ratio|block-size|inline-size|text-indent)/;

export const kebab = (p: string): string => p.replace(/[A-Z]/g, m => "-" + m.toLowerCase());

export function classifyProps(props: readonly string[]): AnimCost {
    let rank = 0;
    for (const raw of props) {
        const p = kebab(raw);
        const r = CHEAP.has(p) ? 0 : GPU.has(p) ? 1 : LAYOUT.test(p) ? 3 : 2;
        if (r > rank) {
            rank = r;
        }
    }
    return (["cheap", "gpu", "paint", "layout"] as const)[rank];
}

/** Largest blur radius (px) in a computed box-shadow / text-shadow value. */
export function maxShadowBlur(value: string | null | undefined): number {
    if (!value || value === "none") {
        return 0;
    }
    const stripped = value.replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b/gi, "");
    let max = 0;
    for (const part of stripped.split(",")) {
        const nums = (part.match(/-?\d*\.?\d+(?=px)/g) || []).map(Number);
        if (nums.length >= 3 && nums[2] > max) {
            max = nums[2];
        }
    }
    return max;
}

/** Largest blur() radius (px) in a computed filter / backdrop-filter value. */
export function maxFilterBlur(value: string | null | undefined): number {
    if (!value || value === "none") {
        return 0;
    }
    let max = 0;
    for (const m of value.matchAll(/blur\((-?\d*\.?\d+)px\)/g)) {
        max = Math.max(max, Number(m[1]));
    }
    return max;
}

/* ---------- shared shapes ---------- */

export type PerfEventKind = "longtask" | "loaf" | "tap" | "shift" | "stall" | "lag" | "mark";

export interface PerfEvent {
    /** performance.now() when it ended. */
    t: number;
    kind: PerfEventKind;
    /** Duration in ms (0 when it has none). */
    dur: number;
    label: string;
    detail?: string;
    /** Screen and sheet on show when it happened, e.g. "setup+set". */
    ctx: string;
}

export interface AnimInfo {
    key: string;
    type: "animation" | "transition" | "script";
    name: string;
    count: number;
    running: number;
    infinite: boolean;
    props: string[];
    cost: AnimCost;
    /** Running animations whose target is not visible: work for nothing. */
    offscreen: number;
    sample: string;
    /** True when it can be switched off by @keyframes name. */
    killable: boolean;
}

export interface Suspect {
    sel: string;
    why: string;
    n: number;
    score: number;
}

export interface ImageInfo {
    src: string;
    /** Decoded bitmap size, MB. */
    mb: number;
    /** Natural pixels / pixels actually drawn (device pixels). 1 = perfect, 4 = four times too big. */
    oversize: number;
}

export interface AuditResult {
    at: number;
    dom: number;
    scanned: number;
    depth: number;
    counts: { willChange: number; backdrop: number; blur: number; shadow: number; blend: number; mask: number; fixed: number; backface: number };
    svgNodes: number;
    smil: number;
    svgFilters: number;
    suspects: Suspect[];
    images: ImageInfo[];
    imageMb: number;
    /** Median time of a forced style recalculation + layout of the whole page, ms. */
    styleMs: number;
}

export interface Finding {
    level: Health | "info";
    title: string;
    detail?: string;
}

/* ---------- diagnosis ---------- */

export interface DiagnoseInput {
    summary: FrameSummary;
    budget: number;
    /** Events of the last few seconds only. */
    events: readonly PerfEvent[];
    audit?: AuditResult | null;
    anims?: readonly AnimInfo[] | null;
    cls: number;
    /** Longest recent tap (ms), 0 when none. */
    tapWorst: number;
    tapWorstLabel?: string;
    heapGrowthMb: number;
    heapMinutes: number;
    touch: boolean;
    lite: boolean;
    supportsLongTasks: boolean;
}

const pl = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** Turns raw numbers into plain-language findings, most important first. */
export function diagnose(i: DiagnoseInput): Finding[] {
    const out: Finding[] = [];
    const s = i.summary;
    if (s.frames < 30) {
        return [{ level: "info", title: "Collecting frames...", detail: "Keep the page visible for a couple of seconds." }];
    }
    const hz = 1000 / i.budget;
    const slow = healthOf(s, i.budget) !== "ok";

    if (i.budget > 30) {
        out.push({
            level: "warn",
            title: `Display is running at about ${Math.round(hz)} Hz`,
            detail: "A 30 Hz cap is usually iOS Low Power Mode or Android battery saver, not an app bug. Turn it off before judging smoothness."
        });
    }

    const longs = i.events.filter(e => e.kind === "loaf" || e.kind === "longtask");
    /* A long frame with no script in it is the browser busy painting / compositing, not JavaScript. */
    const scripted = longs.filter(e => !e.label.startsWith("rendering only"));
    const lags = i.events.filter(e => e.kind === "lag");
    const blocked = scripted.length + lags.length > 0;
    if (!slow) {
        out.push({ level: "ok", title: `Smooth: ${fmt(s.fps, 0)} fps`, detail: `${fmt(s.p95)} ms p95, ${s.late} late frame${s.late === 1 ? "" : "s"} of ${s.frames}.` });
    }
    else {
        const lvl: Health = s.lateRatio > 0.1 ? "bad" : "warn";
        out.push({
            level: lvl,
            title: `Dropping frames: ${fmt(s.lateRatio * 100, 0)}% late`,
            detail: `${fmt(s.fps, 0)} fps, p95 ${fmt(s.p95)} ms, worst ${fmt(s.worst, 0)} ms (budget ${fmt(i.budget)} ms). Lost ${fmt(s.lostPerSec, 0)} ms every second.`
        });
        if (blocked) {
            const worst = Math.max(0, ...scripted.map(e => e.dur), ...lags.map(e => e.dur));
            const top = [...scripted].sort((a, b) => b.dur - a.dur)[0];
            out.push({
                level: "bad",
                title: "The main thread is being blocked (JavaScript, style or layout)",
                detail: `${scripted.length} long task${scripted.length === 1 ? "" : "s"}, ${lags.length} timer delay${lags.length === 1 ? "" : "s"}, worst ${fmt(worst, 0)} ms.` + (top ? ` Biggest: ${top.label}${top.detail ? " (" + top.detail + ")" : ""}. See the Log tab.` : " See the Log tab.")
            });
        }
        else {
            out.push({
                level: "warn",
                title: "No script is blocking, yet frames are late: the work is in painting or compositing",
                detail: (longs.length ? `${longs.length} long frame${longs.length === 1 ? "" : "s"} had no script in them. ` : "") + "Typical causes on phones: backdrop-filter / blur, big shadows, blend modes, many forced layers, animations of paint or layout properties. Run Find > Auto-profile to measure which one."
            });
        }
        if (i.touch && !i.lite) {
            out.push({ level: "warn", title: "Lite mode (\"Mod telefon slab\") is off on this touch device", detail: "It stops the heaviest background animations. Turn it on in Settings and re-measure." });
        }
        if (!i.supportsLongTasks) {
            out.push({ level: "info", title: "This browser reports no long tasks (iOS Safari)", detail: "Timer-delay and frame-gap detection is used instead: they still tell JS-bound from render-bound." });
        }
    }

    const a = i.audit;
    if (a) {
        if (a.counts.backdrop > 0) {
            out.push({ level: "warn", title: `${a.counts.backdrop} ${pl(a.counts.backdrop, "element uses", "elements use")} backdrop-filter`, detail: "The most expensive effect on phones: the GPU re-blurs everything behind it every frame." });
        }
        if (a.counts.blur > 0) {
            out.push({ level: "warn", title: `${a.counts.blur} ${pl(a.counts.blur, "element uses", "elements use")} a blur filter`, detail: "Blur is re-rasterised whenever the element or its animation changes." });
        }
        if (a.counts.blend > 0) {
            out.push({ level: "warn", title: `${a.counts.blend} ${pl(a.counts.blend, "element uses", "elements use")} mix-blend-mode`, detail: "Blending forces an offscreen pass for the whole stacking context." });
        }
        if (a.smil > 0) {
            out.push({ level: "warn", title: `${a.smil} SVG SMIL ${pl(a.smil, "animation runs", "animations run")} on the main thread`, detail: "SMIL cannot be turned off from CSS and repaints its SVG every frame." });
        }
        if (a.counts.backface + a.counts.willChange > 25) {
            out.push({ level: "warn", title: `${a.counts.backface + a.counts.willChange} forced GPU layers (will-change / backface-visibility)`, detail: "Each layer costs video memory; hundreds of them make low-RAM phones stutter or flash." });
        }
        if (a.dom > 1500) {
            out.push({ level: "warn", title: `${a.dom} DOM nodes`, detail: "Large trees make every style recalculation slower." });
        }
        if (a.styleMs > 8) {
            out.push({ level: "warn", title: `Full style + layout pass takes ${fmt(a.styleMs)} ms`, detail: "Anything that invalidates the whole page (a class on <html>, a CSS variable on :root) costs this much." });
        }
        if (a.imageMb > 40) {
            out.push({ level: "warn", title: `Images use about ${fmt(a.imageMb, 0)} MB of decoded memory` });
        }
        const big = a.images.filter(m => m.oversize > 2.5 && m.mb > 1);
        if (big.length) {
            out.push({ level: "info", title: `${big.length} image${big.length === 1 ? " is" : "s are"} much larger than shown`, detail: big.slice(0, 3).map(m => `${m.src} ${fmt(m.mb)} MB, ${fmt(m.oversize, 1)}x`).join("; ") });
        }
    }

    const an = i.anims;
    if (an) {
        const heavy = an.filter(x => x.running > 0 && COST_RANK[x.cost] >= 2);
        if (heavy.length) {
            out.push({
                level: "warn",
                title: `${heavy.length} running ${pl(heavy.length, "animation changes", "animations change")} paint or layout properties`,
                detail: heavy.slice(0, 4).map(x => `${x.name} (${x.props.join(", ") || "?"})`).join("; ") + ". Only transform and opacity animate on the compositor for free."
            });
        }
        const waste = an.reduce((n, x) => n + x.offscreen, 0);
        if (waste > 0) {
            out.push({ level: "warn", title: `${waste} animation${waste === 1 ? " runs" : "s run"} off-screen`, detail: "Pause or remove them when not visible: they use power for nothing." });
        }
    }

    if (i.cls > 0.1) {
        out.push({ level: "warn", title: `Layout shifted ${fmt(i.cls, 2)} (CLS)`, detail: "Content jumps while loading or opening a sheet: reserve space for it." });
    }
    if (i.tapWorst >= 200) {
        out.push({ level: i.tapWorst >= 500 ? "bad" : "warn", title: `Slow tap response: ${fmt(i.tapWorst, 0)} ms`, detail: (i.tapWorstLabel ? i.tapWorstLabel + ". " : "") + "See the Log tab for the wait / handler / paint split." });
    }
    if (i.heapMinutes >= 1 && i.heapGrowthMb > 20) {
        out.push({ level: "warn", title: `JS memory grew ${fmt(i.heapGrowthMb, 0)} MB in ${fmt(i.heapMinutes, 0)} min`, detail: "A possible leak; long sessions on a phone end in a tab reload." });
    }
    return out;
}
