/** The dim behind a sheet on phones must stay a flat colour with no animation: a fading screen-sized gradient flashed and dropped frames when a sheet opened. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("phone sheet dim", () => {
    const css = readFileSync(new URL("../../src/lib/styles/performance.css", import.meta.url), "utf8");
    const rule = css.split("\n").find(l => l.includes(".scrim::before")) ?? "";

    it("is a flat colour", () => {
        expect(rule).toMatch(/\.scrim::before\{[^}]*background:rgba\(17,17,20,\.4\)/);
        expect(rule).not.toMatch(/gradient/);
    });

    it("has no animation of its own", () => {
        expect(rule).not.toMatch(/animation:(?!none)/);
        expect(css).not.toMatch(/@keyframes dimin|animation:dimin/);
    });
});
