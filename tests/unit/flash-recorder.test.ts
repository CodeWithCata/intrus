/** The flash recorder's plain-language analysis of what changed after a tap. */
import { describe, expect, it } from "vitest";
import { analyse, type FlashLine } from "#lib/components/debug/flash.ts";

const L = (kind: string, text: string, t = 10): FlashLine => ({ t, kind, text });

describe("flash analysis", () => {
    it("names re-created tiles as the classic flash", () => {
        const s = analyse([L("removed", "div.cats > button.cat (-6 inside)"), L("added", "div.cats > button.cat (+6 inside)")], true);
        expect(s[0]).toMatch(/RE-CREATED/);
    });

    it("flags an entrance animation on opacity", () => {
        const s = analyse([L("animationstart", "pin on button.cat [opacity,transform]")], true);
        expect(s.some(x => /opacity 0|opacity/.test(x))).toBe(true);
    });

    it("flags a container that changed opacity or background", () => {
        const s = analyse([L("style", "div.scrim opacity: 1 -> 0.4")], true);
        expect(s.some(x => /big container/.test(x))).toBe(true);
    });

    it("reports layout shifts, and says when they cannot be measured", () => {
        expect(analyse([L("shift", "layout shift 0.0100: div.sum y 300->308")], true).some(x => /Layout shift/.test(x))).toBe(true);
        expect(analyse([L("tap", "x")], false).some(x => /cannot be measured/.test(x))).toBe(true);
    });

    it("points at the compositor when nothing changed in the page", () => {
        const s = analyse([L("tap", "button.cat")], true);
        expect(s).toHaveLength(1);
        expect(s[0]).toMatch(/GPU \/ compositor/);
    });
});
