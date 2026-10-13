/**
 * Reveal-moment sounds and their picker data.
 */
import { hiss } from "#lib/audio/noise.ts";
import { tone } from "#lib/audio/tone.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { vibrate } from "#lib/audio/haptics.ts";

export const RS = ([["off", "Oprit"], ["soapta", "Șoaptă"], ["murmur", "Murmur"], ["suflu", "Suflu"], ["vant", "Vânt"], ["fosnet", "Foșnet"], ["suier", "Șuier"], ["carte", "Carte"], ["clic", "Clic"], ["lacat", "Lacăt"], ["puls", "Puls"], ["sonar", "Sonar"], ["bas", "Bas"]] as any[][]);
/* same sound for every role, so nobody can tell from the sound who the intruder is */

export const RSF: Record<string, () => void> = {
    carte: () => {
        hiss(.13, { f: 1400, to: 4200, q: .8, v: .11, a: .04 });
        hiss(.04, { f: 2200, q: 1.2, v: .1, at: .12, a: .003 });
        tone(130, .14, { v: .2, at: .12, a: .003, lp: 400 });
    },
    clic: () => {
        hiss(.012, { f: 4200, q: 1.5, v: .14, a: .001 });
        hiss(.03, { ty: "lowpass", f: 900, v: .12, at: .012, a: .002 });
        tone(210, .05, { v: .1, at: .01, a: .002, lp: 600 });
    },
    lacat: () => {
        hiss(.012, { f: 3800, q: 2, v: .12, a: .001 });
        tone(170, .05, { v: .12, a: .002, lp: 500 });
        hiss(.015, { f: 3000, q: 2, v: .16, at: .09, a: .001 });
        tone(120, .09, { v: .2, at: .09, a: .002, lp: 350 });
    },
    puls: () => {
        tone(62, .16, { to: 46, sd: .12, v: .5, a: .004 });
        tone(58, .2, { to: 42, sd: .15, v: .38, a: .004, at: .17 });
    },
    sonar: () => {
        tone(440, 1.4, { v: .12, a: .01, lp: 900, r: .7 });
        tone(442, 1.2, { v: .06, a: .01, lp: 700, r: .7 });
    },
    soapta: () => hiss(.42, { f: 2600, q: .7, v: .1, a: .16, r: .25 }),
    murmur: () => ([[2200, 0], [2900, .17], [2500, .32]] as any[][]).forEach(([f, a]) => hiss(.15, { f, q: .9, v: .09, a: .05, at: a, r: .25 })),
    suflu: () => hiss(.55, { f: 1100, to: 650, q: .6, v: .12, a: .2, r: .3 }),
    vant: () => {
        hiss(.3, { f: 500, to: 1800, q: .8, v: .1, a: .2, r: .35 });
        hiss(.35, { f: 1800, to: 600, q: .8, v: .1, a: .04, at: .28, r: .35 });
    },
    fosnet: () => [0, .07, .13, .22, .28].forEach((a, k) => hiss(.05 + (k % 2) * .02, { f: 3200 + k * 350, q: 1.1, v: .05 + (k % 3) * .02, a: .01, at: a, r: .15 })),
    suier: () => hiss(.5, { f: 4800, to: 3000, q: .55, v: .07, a: .2, r: .2 }),
    bas: () => {
        tone(78, .35, { to: 44, sd: .25, v: .5, a: .004 });
        hiss(.04, { ty: "lowpass", f: 500, v: .1, a: .002 });
    }
};

export const rvSnd = (k?: any) => {
    (RSF[k] || RSF.soapta)();
};

export const rvFx = () => {
    if (state.rs !== "off") {
        rvSnd(state.rs);
    }
    if (state.rb !== "off") {
        vibrate(RBP[state.rb] || 30);
    }
};

export const RB = ([["off", "Oprită"], ["tick", "Scurtă"], ["dbl", "Dublă"], ["long", "Lungă"]] as any[][]);

export const RBP: Record<string, number | number[]> = { tick: 30, dbl: [25, 40, 25], long: 90 };
