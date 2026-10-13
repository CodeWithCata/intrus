/** Switching theme must not flash, and must stay cheap on phones. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allCss } from "./helpers/css.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("theme switch", () => {
    const css = allCss();
    const ts = read("../../src/lib/components/settings/settings.ts");
    const fn = ts.slice(ts.indexOf("export function pickTheme"), ts.indexOf("export function pickAccent"));

    it("no longer fades colours element by element (that flashed: gradients and shadows cannot fade)", () => {
        expect(css).not.toContain("tswap");
        expect(ts).not.toContain("tswap");
    });

    it("cross-fades the whole page as one picture, on mouse devices only", () => {
        const rules = css.split("\n").filter(l => l.includes("::view-transition"));
        expect(rules.length).toBeGreaterThan(0);
        for (const l of rules) {
            expect(l, l).toMatch(/@media \(hover:hover\) and \(pointer:fine\)/);
        }
        expect(ts).toMatch(/canFadeTheme = \(\) => !state\.lite && matchMedia\("\(hover:hover\) and \(pointer:fine\)"\)/);
        expect(fn).toMatch(/if \(canFadeTheme\(\) && doc\.startViewTransition\)/);
    });

    it("always ends up applying the theme, with or without the View Transitions API", () => {
        expect(fn).toContain("doc.startViewTransition(apply)");
        expect(fn.match(/apply\(\)/g)!.length).toBeGreaterThanOrEqual(2); // the catch and the plain else
    });
});
