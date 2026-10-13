/**
 * Named sound effects (SFX.win, SFX.err, ...).
 */
import { tone } from "#lib/audio/tone.ts";
import { hiss } from "#lib/audio/noise.ts";

export const SFX = {
    err: () => {
        [0, .13].forEach(a => {
            tone(150, .08, { t: "triangle", to: 95, v: .26, at: a, a: .002, lp: 550 });
            hiss(.02, { f: 1200, q: 1, v: .08, at: a, a: .002 });
        });
    },
    tick: (u?: any) => {
        hiss(.03, { f: 2000, q: 2, v: u ? .12 : .07, a: .002 });
        tone(u ? 220 : 170, .05, { v: u ? .14 : .08, a: .002, lp: 500 });
        if (u) {
            tone(60, .12, { to: 45, v: .28, a: .004 });
        }
    },
    gong: () => {
        tone(98, 1.6, { v: .3, r: .6, lp: 520, h: 2.4, a: .006 });
        tone(65, 1.2, { v: .3, a: .006, lp: 300 });
    },
    votes: () => {
        hiss(.18, { f: 900, to: 3000, q: .7, v: .08, a: .07 });
        tone(110, .25, { to: 70, sd: .2, v: .3, a: .004, at: .16, lp: 500 });
    },
    intrus: () => {
        hiss(.34, { ty: "lowpass", f: 180, to: 2400, q: .7, v: .2, a: .3 });
        tone(75, 1, { to: 36, sd: .6, v: .5, a: .003, at: .33 });
        tone(110, .9, { v: .12, at: .33, r: .5, lp: 500 });
        tone(116.5, .9, { v: .12, at: .33, r: .5, lp: 500 });
    },
    troll: () => {
        tone(220, .8, { t: "triangle", to: 65, sd: .7, vib: 5, v: .26, lp: 700, r: .3 });
        hiss(.55, { f: 1600, to: 300, q: .8, v: .06, a: .05 });
    },
    win: () => {
        hiss(.1, { f: 2400, q: .9, v: .08, a: .01 });
        tone(165, .9, { v: .17, lp: 700, r: .5, a: .01 });
        tone(247, 1, { v: .1, at: .12, lp: 700, r: .5, a: .01 });
    }
};
