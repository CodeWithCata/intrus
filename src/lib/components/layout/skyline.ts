/**
 * Desktop skyline: two flat-vector city blocks that flank the centred 480 px column on wide screens.
 *
 * Pure constants in, one markup string out (no user text, no images, nothing to download). Background.svelte appends it
 * to the background art; `.bgw.flank` in styles/base.css shows it from 1000 px up and hides it below, so phones never
 * lay it out.
 *
 * It copies the look of the existing city art: three lavender depth layers, white window grids, a few lit windows, plus
 * the animation classes the rest of the background already uses (.tw twinkle, .bl beacon, .sm smoke, .sweep searchlight,
 * .mb glow pulse). Those classes are already covered by "Mod telefon slab", reduced motion, the paused-off-home rule and
 * the sheet-open pause, and the dark theme filters `.bgart .bgw`, so none of that needs new CSS.
 *
 * Left block: radio mast with a red beacon, water tank, chimney smoke and a pink searchlight.
 * Right block: a rooftop "?" sign (the answer to the INTRUS billboard in the middle of the art) and a beacon.
 */

const W = 900;
const H = 600;

/** The sign and the lit windows share the page's lamp colour. */
const AMBER = "#FFC27A";
const RED = "#D8002B";

interface Block {
    w: number;
    h: number;
    /** Antenna height above the roof (a beacon is added when `beacon` is set). */
    ant?: number;
    beacon?: boolean;
    /** Setback on top: [inset per side, extra height]. */
    step?: [number, number];
    mast?: boolean;
    tank?: boolean;
    sign?: boolean;
    chimney?: boolean;
    beam?: boolean;
}

const b = (w: number, h: number, o: Omit<Block, "w" | "h"> = {}): Block => ({ w, h, ...o });

// Blocks run from the inner edge (next to the app column) outwards. Each layer uses different widths, so edges never line up.
const LEFT: Block[][] = [
    [
        b(64, 330),
        b(52, 420, { ant: 40, beacon: true }),
        b(80, 300),
        b(58, 380),
        b(92, 340),
        b(56, 450, { ant: 46 }),
        b(84, 310),
        b(66, 365),
        b(88, 300),
        b(60, 410),
        b(92, 325),
        b(100, 360),
        b(60, 330)
    ],
    [
        b(96, 250),
        b(72, 300, { mast: true }),
        b(84, 215, { tank: true }),
        b(74, 330, { step: [12, 38], ant: 30 }),
        b(100, 240),
        b(64, 290),
        b(96, 225),
        b(70, 310, { ant: 34 }),
        b(92, 255),
        b(78, 290),
        b(120, 235)
    ],
    [
        b(96, 125),
        b(84, 160),
        b(100, 120, { beam: true }),
        b(70, 185, { chimney: true }),
        b(112, 135),
        b(84, 175),
        b(100, 110),
        b(76, 160),
        b(110, 135),
        b(120, 170)
    ]
];
const RIGHT: Block[][] = [
    [
        b(60, 360),
        b(84, 300),
        b(56, 420, { ant: 38, beacon: true }),
        b(90, 330),
        b(64, 385),
        b(100, 300),
        b(60, 445, { ant: 46 }),
        b(92, 320),
        b(76, 370),
        b(96, 300),
        b(60, 410),
        b(120, 330)
    ],
    [
        b(70, 200),
        b(110, 235, { sign: true }),
        b(76, 300, { step: [10, 34], ant: 36, beacon: true }),
        b(100, 215),
        b(84, 265),
        b(96, 320, { ant: 28 }),
        b(70, 240),
        b(104, 290),
        b(80, 230),
        b(90, 300),
        b(105, 250),
        b(80, 260)
    ],
    [b(96, 120), b(104, 170), b(70, 130), b(96, 185, { chimney: true }), b(110, 125), b(76, 165), b(96, 115), b(100, 175), b(84, 130), b(115, 160), b(90, 140)]
];

/** Back, middle, front: lighter and hazier the further back. Gradients are in user space so tall towers get darker tops. */
const LAYER = [
    { y1: 110, a: "#DCDFEA", z: "#EEEFF5", win: 0.3, shade: 0.06, amber: 0, red: 0, ink: "#B4B8CE" },
    { y1: 270, a: "#C2C6DA", z: "#E4E5EF", win: 0.42, shade: 0.09, amber: 0.02, red: 0.008, ink: "#9498B3" },
    { y1: 400, a: "#9A9EBA", z: "#D8DAE7", win: 0.52, shade: 0.13, amber: 0.035, red: 0.012, ink: "#767A98" }
];

/** Small seeded generator: the skyline is the same on every load (and in tests). */
function prng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const n = (v: number) => String(Math.round(v * 10) / 10);

/** Ids are per side: the two svgs sit in one document and an id must be unique in it. */
function defs(s: string): string {
    let d = "<defs>";
    LAYER.forEach((L, i) => {
        d += `<linearGradient id="dkg${i}${s}" gradientUnits="userSpaceOnUse" x1="0" y1="${L.y1}" x2="0" y2="${H}"><stop offset="0" stop-color="${L.a}"/><stop offset="1" stop-color="${L.z}"/></linearGradient>`;
        d += `<pattern id="dkw${i}${s}" width="9" height="12" patternUnits="userSpaceOnUse"><rect x="2.5" y="3" width="3" height="4.5" rx=".6" fill="#fff" fill-opacity="${L.win}"/></pattern>`;
    });
    d += `<linearGradient id="dksb${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0304F"/><stop offset="1" stop-color="#B80024"/></linearGradient>`;
    d += `<radialGradient id="dkgl${s}"><stop offset="0" stop-color="#FF3358" stop-opacity=".34"/><stop offset=".6" stop-color="#FF3358" stop-opacity=".12"/><stop offset="1" stop-color="#FF3358" stop-opacity="0"/></radialGradient>`;
    d += `<linearGradient id="dkbm${s}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-340"><stop offset="0" stop-color="#FFA3B8" stop-opacity=".55"/><stop offset="1" stop-color="#FFA3B8" stop-opacity="0"/></linearGradient>`;
    d += `<linearGradient id="dkms${s}" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="${H}"><stop offset="0" stop-color="#F4F4F8" stop-opacity="0"/><stop offset="1" stop-color="#F4F4F8" stop-opacity=".88"/></linearGradient>`;
    return d + "</defs>";
}

/** Radio mast: two leaning legs, zig-zag bracing, two platforms and a blinking red beacon on the tip. */
function mast(cx: number, y: number): string {
    const height = 150;
    const base = 14;
    const tip = 2.4;
    const segs = 7;
    const pts: [number, number][] = [];
    let struts = "";
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const half = base + (tip - base) * t;
        const yy = y - height * t;
        pts.push([cx + (i % 2 ? half : -half), yy]);
        if (i > 0) struts += `M${n(cx - half)} ${n(yy)}H${n(cx + half)}`;
    }
    const zig = pts.map(([px, py], i) => `${i ? "L" : "M"}${n(px)} ${n(py)}`).join("");
    const plat = (t: number) => {
        const half = base + (tip - base) * t + 4;
        return `<rect x="${n(cx - half)}" y="${n(y - height * t - 1)}" width="${n(half * 2)}" height="2.2" rx="1" fill="#7E83A0"/>`;
    };
    return (
        `<g fill="none" stroke="#8387A4" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M${cx - base} ${y}L${cx - tip} ${y - height}M${cx + base} ${y}L${cx + tip} ${y - height}M${cx} ${y - height}V${y - height - 16}" stroke-width="1.7"/>` +
        `<path d="${zig}${struts}" stroke-width="1"/></g>` +
        plat(0.42) +
        plat(0.74) +
        `<circle class="bl" cx="${cx}" cy="${y - height - 17}" r="7" fill="${RED}" fill-opacity=".22"/>` +
        `<circle class="bl" cx="${cx}" cy="${y - height - 17}" r="2.6" fill="${RED}"/>`
    );
}

/** Rooftop water tank on legs, like the one in the middle art. */
function tank(cx: number, y: number): string {
    return (
        `<path d="M${cx - 9} ${y}V${y - 12}M${cx + 9} ${y}V${y - 12}M${cx - 9} ${y - 2}L${cx + 9} ${y - 11}M${cx + 9} ${y - 2}L${cx - 9} ${y - 11}" fill="none" stroke="#7E83A0" stroke-width="1.5" stroke-linecap="round"/>` +
        `<rect x="${cx - 12}" y="${y - 36}" width="24" height="25" rx="2.5" fill="#8E93AE"/>` +
        `<rect x="${cx + 2}" y="${y - 36}" width="10" height="25" rx="2.5" fill="#1B1E38" fill-opacity=".14"/>` +
        `<path d="M${cx - 12} ${y - 28}H${cx + 12}M${cx - 12} ${y - 19}H${cx + 12}" stroke="#fff" stroke-opacity=".28" stroke-width=".9"/>` +
        `<path d="M${cx - 15} ${y - 36}L${cx} ${y - 48}L${cx + 15} ${y - 36}z" fill="#7C8199"/>`
    );
}

/** Brick chimney with two lazy smoke puffs (same puff shape and fade as the city art). */
function chimney(x: number, y: number, rnd: () => number): string {
    const puff = (delay: number) =>
        `<g transform="translate(${n(x + 4)} ${y - 16})"><path class="sm" style="animation-delay:-${delay}s" d="M0 0c-9-10 8-16-2-28s8-18 0-30" fill="none" stroke="#2C3050" stroke-opacity=".08" stroke-width="9" stroke-linecap="round"/></g>`;
    return (
        puff(0) +
        puff(3 + Math.floor(rnd() * 3)) +
        `<rect x="${n(x)}" y="${y - 14}" width="8" height="14" fill="#6F7392"/><rect x="${n(x - 1)}" y="${y - 16.5}" width="10" height="2.6" rx=".8" fill="#5C6080"/>`
    );
}

/** Pink searchlight: a lamp on the roof and a soft cone that sways. Group rotates, the inner path sweeps about the lamp. */
function searchlight(cx: number, y: number): { beam: string; lamp: string } {
    return {
        beam: `<g transform="translate(${n(cx)} ${y - 3}) rotate(-15)"><path class="sweep" d="M-3 0L-62 -340H62L3 0z" fill="url(#dkbm{S})"/></g>`,
        lamp: `<rect x="${n(cx - 6)}" y="${y - 5}" width="12" height="5" rx="1.5" fill="#5C6080"/><ellipse cx="${n(cx)}" cy="${y - 5.5}" rx="5.5" ry="2.6" fill="#FFD6DF"/>`
    };
}

/** Rooftop "?" sign on a lattice frame, in the red of the INTRUS billboard, with a slow-pulsing glow behind it. */
function sign(cx: number, y: number): { under: string; over: string } {
    const bw = 84;
    const bh = 56;
    const by = y - 24;
    const ty = by - bh;
    const x0 = cx - bw / 2;
    const lamp = (lx: number) =>
        `<path d="M${lx} ${ty}v-7h6" fill="none" stroke="#767A98" stroke-width="1.2" stroke-linecap="round"/><circle cx="${lx + 6}" cy="${ty - 7}" r="1.7" fill="#FFF3DC" stroke="#767A98" stroke-width=".7"/>`;
    return {
        under: `<ellipse class="mb" cx="${cx}" cy="${ty + bh / 2}" rx="108" ry="66" fill="url(#dkgl{S})"/>`,
        over:
            `<path d="M${cx - 30} ${y}V${by}M${cx + 30} ${y}V${by}" stroke="#767A98" stroke-width="2.4" fill="none"/>` +
            `<path d="M${cx - 30} ${y}L${cx + 30} ${by}M${cx + 30} ${y}L${cx - 30} ${by}M${cx - 30} ${y - 12}H${cx + 30}" stroke="#767A98" stroke-width="1.1" fill="none"/>` +
            `<rect x="${x0}" y="${ty}" width="${bw}" height="${bh}" rx="5" fill="url(#dksb{S})"/>` +
            `<rect x="${x0}" y="${ty}" width="${bw}" height="19" rx="5" fill="#fff" fill-opacity=".12"/>` +
            `<rect x="${x0 + 4.5}" y="${ty + 4.5}" width="${bw - 9}" height="${bh - 9}" rx="3" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>` +
            `<text x="${cx}" y="${ty + bh - 11}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="46" fill="#fff">?</text>` +
            lamp(cx - 28) +
            lamp(cx - 3) +
            lamp(cx + 22)
    };
}

/** One depth layer: bodies, windows, shading, ledges, lit windows, then the rooftop details. Returns what goes behind and in front. */
function layer(s: "l" | "r", li: number, blocks: Block[], rnd: () => number): { pre: string; main: string } {
    const L = LAYER[li];
    let body = "";
    let wins = "";
    let shade = "";
    let caps = "";
    let amber = "";
    let glow = "";
    let red = "";
    let twink = "";
    let ants = "";
    let boxes = "";
    let under = "";
    let extras = "";
    let pre = "";

    /** One rectangle of the tower: body, a darker right-hand face, a bright roof edge, window grid and lit windows. */
    const slab = (x: number, w: number, y0: number, y1: number) => {
        const sw = Math.min(22, w * 0.28);
        body += `M${x} ${y0}h${w}V${y1}h${-w}z`;
        shade += `M${n(x + w - sw)} ${y0}h${n(sw)}V${y1}h${n(-sw)}z`;
        caps += `M${x} ${y0}h${w}v1.6h${-w}z`;
        // The grid is a user-space pattern (9 x 12 cells), so the window area and the lit windows snap to its cells.
        const c0 = Math.ceil((x + 4) / 9);
        const c1 = Math.floor((x + w - 4) / 9);
        const r0 = Math.ceil((y0 + 10) / 12);
        const r1 = Math.floor(y1 / 12);
        if (c1 <= c0 || r1 <= r0) return;
        wins += `M${c0 * 9} ${r0 * 12}H${c1 * 9}V${r1 * 12}H${c0 * 9}z`;
        for (let r = r0; r < r1; r++) {
            for (let c = c0; c < c1; c++) {
                const p = rnd();
                const wx = c * 9 + 2.5;
                const wy = r * 12 + 3;
                if (wy > 520) continue; // the ground haze covers everything below
                if (p < L.amber) {
                    if (rnd() < 0.4) {
                        twink +=
                            `<rect class="tw" style="animation-delay:-${Math.floor(rnd() * 5)}s" x="${n(wx)}" y="${wy}" width="3" height="4.5" rx=".6" fill="${AMBER}" fill-opacity=".9"/>` +
                            `<circle cx="${n(wx + 1.5)}" cy="${wy + 2}" r="7" fill="${AMBER}" fill-opacity=".16"/>`;
                    } else {
                        amber += `M${n(wx)} ${wy}h3v4.5h-3z`;
                        glow += `M${n(wx - 5.5)} ${wy + 2}a7 7 0 1 0 14 0a7 7 0 1 0-14 0`;
                    }
                } else if (p < L.amber + L.red) {
                    red += `M${n(wx)} ${wy}h3v4.5h-3z`;
                }
            }
        }
    };

    let d = 0;
    for (const k of blocks) {
        if (d > W + 40) break;
        const x = s === "l" ? W - d - k.w : d;
        d += k.w;
        const top = H - k.h;
        const cx = x + k.w / 2;
        let roof = top;
        slab(x, k.w, top, H);
        if (k.step) {
            const [inset, extra] = k.step;
            roof = top - extra;
            slab(x + inset, k.w - inset * 2, roof, top);
            // Ledges either side of the setback.
            caps += `M${x} ${top}h${inset}v1.6h${-inset}zM${x + k.w - inset} ${top}h${inset}v1.6h${-inset}z`;
        }
        if (k.ant) {
            ants += `M${n(cx - 0.7)} ${roof}v${-k.ant}h1.4v${k.ant}z`;
            if (k.beacon) {
                const bx = n(cx);
                const by = roof - k.ant - 1;
                const delay = `animation-delay:-${(rnd() * 2.4).toFixed(1)}s`;
                extras += `<circle class="bl" style="${delay}" cx="${bx}" cy="${by}" r="7" fill="${RED}" fill-opacity=".22"/><circle class="bl" style="${delay}" cx="${bx}" cy="${by}" r="2.6" fill="${RED}"/>`;
            }
        }
        if (k.mast) extras += mast(cx, roof);
        if (k.tank) extras += tank(cx, roof);
        if (k.chimney) extras += chimney(x + k.w * 0.68, roof, rnd);
        if (k.beam) {
            const sl = searchlight(cx, roof);
            pre += sl.beam;
            extras += sl.lamp;
        }
        if (k.sign) {
            const sg = sign(cx, roof);
            under += sg.under;
            extras += sg.over;
        }
        // A rooftop air-conditioner on about half of the plain front roofs.
        if (li === 2 && !k.chimney && !k.beam && rnd() < 0.6) {
            const bx = x + 6 + rnd() * Math.max(4, k.w - 30);
            boxes += `M${n(bx)} ${roof - 6}h13v6h-13zM${n(bx + 3)} ${roof - 9}h7v3h-7z`;
        }
    }

    const g = `${li}${s}`;
    const path = (dd: string, attrs: string) => (dd ? `<path d="${dd}" ${attrs}/>` : "");
    const main =
        path(body, `fill="url(#dkg${g})"`) +
        path(wins, `fill="url(#dkw${g})"`) +
        path(shade, `fill="#1B1E38" fill-opacity="${L.shade}"`) +
        path(caps, `fill="#fff" fill-opacity=".55"`) +
        under +
        path(glow, `fill="${AMBER}" fill-opacity=".16"`) +
        path(amber, `fill="${AMBER}" fill-opacity=".9"`) +
        twink +
        path(red, `fill="${RED}" fill-opacity=".9"`) +
        path(ants, `fill="${L.ink}"`) +
        path(boxes, `fill="${L.ink}" fill-opacity=".85"`) +
        extras;
    return { pre, main };
}

function flank(s: "l" | "r", seed: number, layers: Block[][]): string {
    const rnd = prng(seed);
    let art = "";
    layers.forEach((blocks, li) => {
        const { pre, main } = layer(s, li, blocks, rnd);
        art += pre + main;
    });
    // The page-colour haze at the foot, like the mist strip of the city art, so the buildings sink into the ground.
    art += `<rect x="0" y="470" width="${W}" height="${H - 470}" fill="url(#dkms${s})"/>`;
    // The inner edge is the side facing the app column: the art is anchored there and cropped on the outside when narrow.
    const anchor = s === "l" ? "xMaxYMax" : "xMinYMax";
    const markup = `<div class="bgw flank ${s}" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="${anchor} slice" aria-hidden="true" focusable="false">${defs(s)}${art}</svg></div>`;
    // The shared helpers write "{S}" where an id needs its side suffix.
    return markup.replace(/\{S\}/g, s);
}

/** Both blocks, ready to append inside `.bgart`. */
export const SKYLINE: string = flank("l", 7, LEFT) + flank("r", 19, RIGHT);
