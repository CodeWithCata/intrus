/**
 * In the dark and noir themes `--ink` is light, so a rule that paints `background: var(--ink)` and sets a fixed `color: #fff` gives white
 * text on a near-white fill. Every such rule needs a counterpart under `data-theme` (see the `.btn.go` block in styles/themes.css).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../../src/lib/styles/", import.meta.url);
const css = readdirSync(dir).filter(f => f.endsWith(".css")).map(f => readFileSync(new URL(f, dir), "utf8")).join("\n");
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));

const themed = rules.filter(r => r.sel.includes("data-theme")).map(r => r.sel).join("\n");
const classOf = (sel: string) => sel.match(/\.[\w-]+/g)?.pop() ?? "";

describe("ink-filled badges stay readable in the dark themes", () => {
    const risky = rules.filter(r => !r.sel.includes("data-theme") && /background(-color)?:var\(--ink\)/.test(r.body) && /(^|;)color:#fff/.test(r.body));

    it("finds the rules it is meant to guard", () => {
        expect(risky.length).toBeGreaterThan(5);
    });

    for (const r of risky) {
        for (const sel of r.sel.split(",").map(s => s.trim())) {
            it(`${sel} has a dark/noir counterpart`, () => {
                expect(themed).toContain(classOf(sel));
            });
        }
    }
});
