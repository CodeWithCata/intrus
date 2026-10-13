/** The performance debugger's logic: frame maths, diagnosis rules, CSS builder and the rules it is built under. */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { FEATURES, REDUCERS, buildFeatureCss } from "#lib/components/debug/features.ts";
import { classifyProps, describeNode, diagnose, healthOf, maxFilterBlur, maxShadowBlur, percentile, snapBudget, summarizeFrames, type AuditResult, type DiagnoseInput, type PerfEvent } from "#lib/components/debug/stats.ts";

const B60 = 1000 / 60;
const steady = (n: number, d = B60) => Array.from({ length: n }, () => d);

describe("frame maths", () => {
    it("snaps to the real refresh rates", () => {
        expect(snapBudget(16.2)).toBeCloseTo(B60);
        expect(snapBudget(8.6)).toBeCloseTo(1000 / 120);
        expect(snapBudget(33)).toBeCloseTo(1000 / 30);
        expect(snapBudget(11)).toBeCloseTo(1000 / 90);
    });

    it("interpolates percentiles", () => {
        expect(percentile([], 0.5)).toBe(0);
        expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
        expect(percentile([10, 20], 0.5)).toBe(15);
        expect(percentile([1, 2, 3], 2)).toBe(3);
    });

    it("a steady 60 fps run loses nothing", () => {
        const s = summarizeFrames(steady(120), B60);
        expect(s.fps).toBeCloseTo(60, 0);
        expect(s.late).toBe(0);
        expect(s.lostPerSec).toBe(0);
        expect(healthOf(s, B60)).toBe("ok");
    });

    it("counts late frames and the time they cost", () => {
        const d = [...steady(98), 50, 100];
        const s = summarizeFrames(d, B60);
        expect(s.late).toBe(2);
        expect(s.worst).toBe(100);
        expect(s.lostPerSec).toBeGreaterThan(40);
        expect(healthOf(s, B60)).not.toBe("ok");
        expect(summarizeFrames([], B60).frames).toBe(0);
    });

    it("jitter of one vsync is not a late frame", () => {
        expect(summarizeFrames(steady(100, 20), B60).late).toBe(0);
    });
});

describe("css classification", () => {
    it("ranks animated properties by cost", () => {
        expect(classifyProps(["transform", "opacity"])).toBe("cheap");
        expect(classifyProps(["filter"])).toBe("gpu");
        expect(classifyProps(["boxShadow"])).toBe("paint");
        expect(classifyProps(["background-color", "transform"])).toBe("paint");
        expect(classifyProps(["width"])).toBe("layout");
        expect(classifyProps(["margin-top", "opacity"])).toBe("layout");
    });

    it("reads blur radii out of computed values", () => {
        expect(maxShadowBlur("none")).toBe(0);
        expect(maxShadowBlur("rgba(0, 0, 0, 0.3) 0px 8px 24px 0px, rgb(1, 2, 3) 0px 1px 2px 0px")).toBe(24);
        expect(maxFilterBlur("blur(12px) drop-shadow(rgba(0, 0, 0, 0.5) 0px 2px 4px)")).toBe(12);
        expect(maxFilterBlur("none")).toBe(0);
    });

    it("describes nodes briefly and without framework classes", () => {
        const el = { nodeType: 1, localName: "div", id: "x", getAttribute: () => "card svelte-abc dbg-y big extra" } as unknown as Node;
        expect(describeNode(el)).toBe("div#x.card.big");
        expect(describeNode(null)).toBe("(detached)");
    });
});

const ev = (kind: PerfEvent["kind"], dur: number, label: string): PerfEvent => ({ t: 0, kind, dur, label, ctx: "setup" });
const input = (over: Partial<DiagnoseInput> = {}): DiagnoseInput => ({
    summary: summarizeFrames(steady(120), B60),
    budget: B60,
    events: [],
    cls: 0,
    tapWorst: 0,
    heapGrowthMb: 0,
    heapMinutes: 0,
    touch: false,
    lite: true,
    supportsLongTasks: true,
    ...over
});
const choppy = summarizeFrames([...steady(80), ...steady(40, 50)], B60);
const titles = (i: DiagnoseInput) => diagnose(i).map(f => f.title);

describe("diagnosis", () => {
    it("waits for enough frames", () => {
        expect(diagnose(input({ summary: summarizeFrames(steady(5), B60) }))[0].level).toBe("info");
    });

    it("calls a smooth page smooth", () => {
        const f = diagnose(input());
        expect(f[0].level).toBe("ok");
        expect(f.some(x => x.level === "bad")).toBe(false);
    });

    it("blames the main thread when scripts or timers were blocked", () => {
        const f = diagnose(input({ summary: choppy, events: [ev("loaf", 180, "onclick 170 ms"), ev("lag", 90, "timers late")] }));
        expect(f.some(x => x.level === "bad" && /main thread/.test(x.title))).toBe(true);
    });

    it("blames painting when frames are late but nothing blocked, and long frames without script do not count as JS", () => {
        const f = titles(input({ summary: choppy, events: [ev("loaf", 120, "rendering only, no script"), ev("stall", 150, "no frame")] }));
        expect(f.some(t => /painting or compositing/.test(t))).toBe(true);
        expect(f.some(t => /main thread is being blocked/.test(t))).toBe(false);
    });

    it("recognises a 30 Hz cap", () => {
        const budget = 1000 / 30;
        expect(titles(input({ budget, summary: summarizeFrames(steady(120, budget), budget) })).some(t => /30 Hz/.test(t))).toBe(true);
    });

    it("explains expensive CSS from the audit and tips lite mode on touch", () => {
        const audit: AuditResult = {
            at: 0, dom: 2000, scanned: 2000, depth: 10, svgNodes: 0, smil: 3, svgFilters: 0, suspects: [], images: [], imageMb: 0, styleMs: 12,
            counts: { willChange: 0, backdrop: 4, blur: 0, shadow: 0, blend: 0, mask: 0, fixed: 0, backface: 0 }
        };
        const t = titles(input({ summary: choppy, audit, touch: true, lite: false }));
        expect(t.some(x => /backdrop-filter/.test(x))).toBe(true);
        expect(t.some(x => /SMIL/.test(x))).toBe(true);
        expect(t.some(x => /DOM nodes/.test(x))).toBe(true);
        expect(t.some(x => /Full style/.test(x))).toBe(true);
        expect(t.some(x => /Lite mode/.test(x))).toBe(true);
    });

    it("flags paint-cost and off-screen animations", () => {
        const anims = [{ key: "a", type: "animation" as const, name: "glow", count: 2, running: 2, infinite: true, props: ["box-shadow"], cost: "paint" as const, offscreen: 1, sample: "div", killable: true }];
        const t = titles(input({ anims }));
        expect(t.some(x => /paint or layout/.test(x))).toBe(true);
        expect(t.some(x => /off-screen/.test(x))).toBe(true);
    });
});

describe("experiments", () => {
    it("has unique ids and keeps the ids that are saved on devices", () => {
        const ids = FEATURES.map(f => f.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ["bgAnim", "svgAnim", "bgHide", "htmlBg", "heroBeam", "heroArt", "heroSvg", "qs", "layers", "backdrop", "shadows", "filters", "blend", "mask", "scrimDim", "scrimAnim", "sheetAnim", "sheetKids", "screenAnim", "noPause", "trans", "smil", "allAnim", "eyeBtn"]) {
            expect(ids).toContain(id);
        }
    });

    it("never switches on a rule that adds work for the auto-profile", () => {
        expect(REDUCERS.some(f => f.id === "noPause")).toBe(false);
    });

    it("builds scoped rules", () => {
        const css = buildFeatureCss();
        expect(css).toContain("html.dbg-shadows *,html.dbg-shadows *::before,html.dbg-shadows *::after{box-shadow:none!important");
        expect(css).toContain("html.dbg-bgAnim .bgart::before,html.dbg-bgAnim .bgart::after{animation:none!important}");
        expect(css).toContain("html.dbg-htmlBg{background:#fff!important}");
        expect(css).toContain("html.dbg-htmlBg::before{display:none!important}");
        expect(css).toContain("html.dbg-noPause.dbg-noPause.dbg-noPause *");
    });
});

describe("the debugger stays a developer-only, safe tool", () => {
    const dir = new URL("../../src/lib/components/debug/", import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith(".ts"));

    it("never uses innerHTML or any", () => {
        for (const f of files) {
            const src = readFileSync(new URL(f, dir), "utf8");
            expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
            expect(src, f).not.toMatch(/:\s*any\b|\bas any\b|<any>/);
        }
    });

    it("only debug.ts imports from the app", () => {
        for (const f of files.filter(x => x !== "debug.ts")) {
            const src = readFileSync(new URL(f, dir), "utf8");
            const imports = [...src.matchAll(/from "(#lib\/[^"]+)"/g)].map(m => m[1]);
            expect(imports.filter(i => !["#lib/utils/smil.ts", "#lib/utils/frame-stats.ts"].includes(i)), f).toEqual([]);
        }
    });

    it("is not imported statically: boot() loads it on demand", () => {
        const boot = readFileSync(new URL("../../src/lib/boot.ts", import.meta.url), "utf8");
        expect(boot).not.toMatch(/^import .*components\/debug/m);
        expect(boot).toMatch(/import\("#lib\/components\/debug\/debug\.ts"\)/);
    });

    it("keeps its CSS out of the shared stylesheets", () => {
        const css = readFileSync(new URL("../../src/lib/styles/performance.css", import.meta.url), "utf8");
        expect(css).not.toMatch(/\.dbg/);
    });
});
