/** Accent / theme changes and the dark background must stay cheap: no image swaps, no fixed-attachment backgrounds. */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const url = (p: string) => new URL(p, import.meta.url);
const read = (p: string) => readFileSync(url(p), "utf8");
const styles = readdirSync(url("../../src/lib/styles/")).filter(f => f.endsWith(".css"));

describe("wallpaper tiles follow plain colours", () => {
    const motion = read("../../src/lib/styles/motion.css");
    const settings = read("../../src/lib/components/settings/settings.ts");

    it("no longer bakes the accent or theme colour into an image that has to be swapped", () => {
        expect(motion).not.toMatch(/--qwall|--qsoft/);
        expect(settings).not.toMatch(/--qwall|--qsoft/);
    });

    it("paints the wallpaper glyphs with --qink and --red through masks", () => {
        expect(motion).toMatch(/\.bgq::before\{background:var\(--qink\);[^}]*mask:var\(--qm-ink\)/);
        expect(motion).toMatch(/\.bgq::after\{background:var\(--red\);[^}]*mask:var\(--qm-acc\)/);
        expect(motion).toMatch(/html:is\(\[data-theme=dark\],\[data-theme=noir\]\)\{--qink:#fff\}/);
    });

    it("has a tiny sheet tile for every accent of the palette", () => {
        const accs = [...settings.matchAll(/\["#([0-9A-F]{6})", "/g)].map(m => m[1]);
        expect(accs.length).toBeGreaterThan(3);
        for (const a of accs.slice(1)) {
            expect(motion, a).toContain(`html[data-acc="${a}"]{--qs-acc:`);
        }
    });

    it("applyTheme only writes what changed", () => {
        const fn = settings.slice(settings.indexOf("export function applyTheme"), settings.indexOf("/** \"Mod telefon slab\""));
        expect(fn).toMatch(/dataset\.theme !== state\.theme/);
        expect(fn).toMatch(/getPropertyValue\("--red"\) !== state\.acc/);
        expect(fn).toMatch(/dataset\.acc !== acc/);
        expect(fn).not.toMatch(/getComputedStyle/);
    });
});

describe("page background", () => {
    it("never uses a fixed-attachment background: it repaints on every scroll frame on phones (the gradient is html::before)", () => {
        for (const f of styles) {
            const css = read("../../src/lib/styles/" + f);
            expect(css, f).not.toMatch(/background-attachment\s*:\s*fixed/);
            expect(css, f).not.toMatch(/(gradient\([^;{}]*\)|url\([^;{}]*\))[^;{}]*\sfixed\b/);
        }
    });
});

describe("weak-phone hint", () => {
    const hint = read("../../src/lib/components/settings/lite-hint.ts");

    it("is started by boot() and never imports the developer debugger", () => {
        expect(read("../../src/lib/boot.ts")).toMatch(/watchForLite\(\);/);
        expect(hint).not.toMatch(/components\/debug/);
    });

    it("respects a deliberate choice, asks once per device, and waits for a calm moment", () => {
        expect(hint).toMatch(/!state\.lite && !state\.liteSet && !alreadyAsked/);
        expect(hint).toMatch(/markAsked\(\);[\s\S]*toast\(t\("liteHintMsg"\)/);
        expect(hint).toMatch(/!state\.sheet && !MID_ROUND\.includes\(nav\.screen!?\)/);
        expect(hint).toMatch(/prefers-reduced-motion/);
    });
});
