/** The desktop skyline beside the app column: constant SVG, cheap, and covered by the existing background rules. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SKYLINE } from "#lib/components/layout/skyline.ts";
import { allCss } from "./helpers/css.ts";

const url = (p: string) => new URL(p, import.meta.url);
const read = (p: string) => readFileSync(url(p), "utf8");

describe("desktop skyline", () => {
    it("is plain SVG: no images to download, no scripts, no event handlers", () => {
        expect(SKYLINE).not.toMatch(/<img|<script|<foreignObject|\son[a-z]+=|href=|url\(['"]?https?:/i);
        expect(SKYLINE.match(/<svg /g)).toHaveLength(2);
        expect(SKYLINE.length).toBeLessThan(40_000);
    });

    it("has no placeholder left over and no id used twice", () => {
        expect(SKYLINE).not.toContain("{S}");
        const ids = [...SKYLINE.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
        expect(ids.length).toBeGreaterThan(10);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("never reuses an id of the rest of the background (all svgs share one document)", () => {
        const art = read("../../src/lib/components/layout/Background.svelte");
        const taken = new Set([...art.matchAll(/id=\\+"([\w-]+)\\+"/g)].map(m => m[1]));
        expect(taken.size).toBeGreaterThan(10);
        for (const m of SKYLINE.matchAll(/ id="([^"]+)"/g)) expect(taken.has(m[1]), m[1]).toBe(false);
    });

    it("only animates with classes that lite mode, reduced motion and the pause rules already cover", () => {
        const used = new Set([...SKYLINE.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(" ")));
        const known = new Set(["bgw", "flank", "l", "r", "tw", "bl", "sm", "sweep", "mb"]);
        for (const c of used) expect(known.has(c), c).toBe(true);
        const perf = allCss();
        expect(perf).toContain("html.lite .bgart svg :is(.sweep,.dr,.tw,.bl,.sm,.mb,.qm,.ss,.scf)");
        expect(perf).toContain(".bgart .bgw{filter:invert(.9)");
    });

    it("is appended inside .bgart by Background.svelte and shown only from 1000 px up", () => {
        expect(read("../../src/lib/components/layout/Background.svelte")).toMatch(/replace\(\/<\\\/div>\$\/, SKYLINE \+ "<\/div>"\)/);
        const css = allCss();
        expect(css).toContain(".bgart .bgw.flank{display:none}");
        expect(css).toMatch(/@media \(min-width:1000px\)\{\.bgart \.bgw\.flank\{display:block;/);
    });
});
