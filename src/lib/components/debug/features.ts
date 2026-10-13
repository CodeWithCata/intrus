/**
 * The experiments of the performance debugger: each one switches a family of visual effects off
 * through a rule under `html.dbg-<id>` (so a switch can be tried without touching the app's CSS),
 * and `AnimKiller` switches single @keyframes off. Ids are saved in localStorage: do not rename them.
 */
import { smil } from "#lib/utils/smil.ts";

export type FeatureGroup = "Background" | "Hero" | "Paint cost" | "Layers" | "Sheet" | "Motion";

export interface Feature {
    id: string;
    name: string;
    hint: string;
    group: FeatureGroup;
    /** [selector under html.dbg-id (or "ALL" for every element, "html..." for the root), declarations] */
    rules: [string, string][];
    /** Extra JS side of the experiment (SMIL cannot be stopped from CSS). */
    run?: (on: boolean) => void;
    /** Whether the experiment can change anything on the page right now (default: some selector of its rules matches). */
    applies?: () => boolean;
    /** For page-wide switches: true when an element (or pseudo-element) really uses what the switch removes. */
    uses?: (cs: CSSStyleDeclaration) => boolean;
    /** On = MORE work (it undoes an optimisation): never part of "all off" or the auto-profile. */
    inverse?: boolean;
}

const NO_ANIM = "animation:none!important";

export const FEATURES: readonly Feature[] = [
    { id: "bgAnim", group: "Background", name: "Glow drift behind the app", hint: "bgart ::before / ::after animation", rules: [[".bgart::before,.bgart::after", NO_ANIM]] },
    { id: "svgAnim", group: "Background", name: "Sky / city motion", hint: "clouds, beam, twinkles, smoke", rules: [[".bgart svg *", NO_ANIM]] },
    { id: "bgHide", group: "Background", name: "Hide whole background art", hint: "sky + city SVG", rules: [[".bgart", "display:none!important"]] },
    { id: "bgImg", group: "Background", name: "Background photos", hint: "webp images inside the background", rules: [[".bgart img,.bgw>img", "display:none!important"]] },
    { id: "htmlBg", group: "Background", name: "Page gradient", hint: "html fixed background + html::before", rules: [["html", "background:#fff!important"], ["html::before", "display:none!important"]] },
    { id: "heroBeam", group: "Hero", name: "Hero light beam", hint: "hero ::after", rules: [[".hero2::after", "display:none!important"]] },
    { id: "heroArt", group: "Hero", name: "Hero layered artwork", hint: "hero ::before (skyline, stars)", rules: [[".hero2::before", "display:none!important"]] },
    { id: "heroSvg", group: "Hero", name: "Hero character", hint: "hero svg", rules: [[".hero2>svg", "display:none!important"]] },
    { id: "qs", group: "Hero", name: "Floating ? marks", hint: ".qs", rules: [[".qs", "display:none!important"]] },
    { id: "layers", group: "Layers", name: "Forced GPU layers", hint: "will-change / backface-visibility", uses: cs => cs.willChange !== "auto" || cs.backfaceVisibility === "hidden", rules: [["ALL", "will-change:auto!important;backface-visibility:visible!important;-webkit-backface-visibility:visible!important"]] },
    { id: "backdrop", group: "Paint cost", name: "backdrop-filter blur", hint: "everywhere", uses: cs => (cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter") || "none") !== "none", rules: [["ALL", "-webkit-backdrop-filter:none!important;backdrop-filter:none!important"]] },
    { id: "shadows", group: "Paint cost", name: "Shadows", hint: "box-shadow + text-shadow", uses: cs => cs.boxShadow !== "none" || cs.textShadow !== "none", rules: [["ALL", "box-shadow:none!important;text-shadow:none!important"]] },
    { id: "filters", group: "Paint cost", name: "CSS filters", hint: "drop-shadow, blur etc.", uses: cs => cs.filter !== "none", rules: [["ALL", "filter:none!important"]] },
    { id: "blend", group: "Paint cost", name: "Blend modes", hint: "mix-blend-mode", uses: cs => cs.mixBlendMode !== "normal", rules: [["ALL", "mix-blend-mode:normal!important"]] },
    { id: "mask", group: "Paint cost", name: "Masks", hint: "mask-image", uses: cs => (cs.getPropertyValue("mask-image") || cs.getPropertyValue("-webkit-mask-image") || "none") !== "none", rules: [["ALL", "-webkit-mask-image:none!important;mask-image:none!important"]] },
    { id: "scrimDim", group: "Sheet", name: "Dim layer under sheet", hint: "scrim ::before + background", rules: [[".scrim::before", "display:none!important"], [".scrim", "background:none!important"]] },
    { id: "scrimAnim", group: "Sheet", name: "Dim fade-in animation", hint: "scrim animation", rules: [[".scrim,.scrim::before", NO_ANIM]] },
    { id: "sheetAnim", group: "Sheet", name: "Sheet slide-in animation", hint: ".sheet animation", rules: [[".sheet", NO_ANIM]] },
    { id: "sheetKids", group: "Sheet", name: "Sheet content stagger", hint: ".sheet > * animation", rules: [[".sheet>*", NO_ANIM]] },
    { id: "screenAnim", group: "Motion", name: "Screen entrance animations", hint: "stagger, hero, dock", rules: [[".screen,.screen>*,.page2>*,.hero2,.vgrid>*,.stage>div,.score,.dock,.dock>.outcome,#app>.dock", NO_ANIM]] },
    { id: "noPause", group: "Motion", name: "Don't pause scene when sheet opens", hint: "html.sheetopen rule (adds work: test only)", rules: [["ALL", "animation-play-state:running!important"]], inverse: true },
    { id: "trans", group: "Motion", name: "All transitions", hint: "transition", uses: cs => cs.transitionDuration.split(",").some(d => parseFloat(d) > 0), rules: [["ALL", "transition:none!important"]] },
    { id: "smil", group: "Motion", name: "SVG SMIL clock", hint: "<animate> / <animateTransform> (main thread)", rules: [], run: on => smil(document.documentElement, on), applies: () => !!document.querySelector("svg:not(.sprite) :is(animate,animateTransform,animateMotion,set)") },
    { id: "allAnim", group: "Motion", name: "ALL animations", hint: "everything", rules: [["ALL", NO_ANIM]] },
    { id: "eyeBtn", group: "Motion", name: "Test eye button", hint: ".bgtest", rules: [[".bgtest", "display:none!important"]] }
];

/** Ids that "all off" and the auto-profile switch on. */
export const REDUCERS: readonly Feature[] = FEATURES.filter(f => !f.inverse);

const PSEUDO = /::?(before|after)\b/g;

/** Ids of the page-wide switches (`uses`) that something on the page really uses. One pass over the computed styles, a few hundred ms at most. */
export function usedFeatures(limit = 4000): Set<string> {
    const probes = FEATURES.filter(f => f.uses);
    const found = new Set<string>();
    const all = document.getElementsByTagName("*");
    const check = (cs: CSSStyleDeclaration) => {
        for (const f of probes) {
            if (!found.has(f.id) && f.uses?.(cs)) {
                found.add(f.id);
            }
        }
    };
    for (let i = 0; i < all.length && i < limit && found.size < probes.length; i++) {
        const el = all[i];
        check(getComputedStyle(el));
        check(getComputedStyle(el, "::before"));
        check(getComputedStyle(el, "::after"));
    }
    return found;
}

/** False when switching the feature off cannot change this page (its selectors match nothing, or nothing uses it): measuring it would only add noise. */
export function applicable(f: Feature, used?: ReadonlySet<string>): boolean {
    if (f.applies) {
        return f.applies();
    }
    if (f.uses && used) {
        return used.has(f.id);
    }
    if (!f.rules.length) {
        return true;
    }
    return f.rules.some(
        ([sel]) =>
            sel === "ALL" ||
            sel.startsWith("html") ||
            sel.split(",").some(x => {
                try {
                    return !!document.querySelector(x.replace(PSEUDO, "").trim() || "*");
                }
                catch {
                    return true;
                }
            })
    );
}

const GROUP_ORDER: readonly FeatureGroup[] = ["Background", "Hero", "Paint cost", "Layers", "Sheet", "Motion"];
export const featureGroups = (): { group: FeatureGroup; items: Feature[] }[] => GROUP_ORDER.map(group => ({ group, items: FEATURES.filter(f => f.group === group) }));

/** One CSS rule for a feature selector. noPause is repeated to outweigh the app's `html.sheetopen ... !important` rule. */
function cssRule(id: string, sel: string, decl: string): string {
    const cls = ".dbg-" + id;
    const p = "html" + (id === "noPause" ? cls.repeat(3) : cls);
    let s: string;
    if (sel === "ALL") {
        s = `${p} *,${p} *::before,${p} *::after`;
    }
    else if (sel.startsWith("html")) {
        s = p + sel.slice(4);
    }
    else {
        s = sel
            .split(",")
            .map(x => `${p} ${x}`)
            .join(",");
    }
    return `${s}{${decl}}`;
}

export function buildFeatureCss(features: readonly Feature[] = FEATURES): string {
    return features.map(f => f.rules.map(([sel, decl]) => cssRule(f.id, sel, decl)).join("")).join("");
}

/* ---------- per-@keyframes switches ---------- */

interface Found {
    at: string[];
    sel: string;
    names: string[];
}

function collect(rules: CSSRuleList, at: string[], name: string, out: Found[]): void {
    for (const r of Array.from(rules)) {
        if (r instanceof CSSStyleRule) {
            const names = (r.style.animationName || "").split(/\s*,\s*/);
            if (names.includes(name)) {
                out.push({ at, sel: r.selectorText, names });
            }
        }
        else if (r instanceof CSSKeyframesRule || r instanceof CSSFontFaceRule) {
            continue;
        }
        else if ("cssRules" in r) {
            const text = r.cssText;
            collect((r as CSSGroupingRule).cssRules, [...at, text.slice(0, text.indexOf("{")).trim()], name, out);
        }
    }
}

/** Switches single @keyframes off by re-declaring `animation-name: none` for that name wherever a rule uses it. */
export class AnimKiller {
    private sheets = new Map<string, HTMLStyleElement>();
    private active = new Set<string>();

    has(name: string): boolean {
        return this.active.has(name);
    }

    names(): string[] {
        return [...this.active];
    }

    set(names: Iterable<string>): void {
        const next = new Set(names);
        for (const n of this.active) {
            if (!next.has(n)) {
                this.apply(n, false);
            }
        }
        for (const n of next) {
            this.apply(n, true);
        }
        this.active = next;
    }

    private apply(name: string, on: boolean): void {
        let el = this.sheets.get(name);
        if (!el) {
            if (!on) {
                return;
            }
            const found: Found[] = [];
            for (const sh of Array.from(document.styleSheets)) {
                try {
                    collect(sh.cssRules, [], name, found);
                }
                catch {
                    /* cross-origin sheet: unreadable */
                }
            }
            el = document.createElement("style");
            el.textContent = found
                .map(f => {
                    const decl = `${f.sel}{animation-name:${f.names.map(n => (n === name ? "none" : n)).join(",")}!important}`;
                    return f.at.reduceRight((inner, prelude) => `${prelude}{${inner}}`, decl);
                })
                .join("");
            document.head.append(el);
            this.sheets.set(name, el);
        }
        el.disabled = !on;
    }
}
