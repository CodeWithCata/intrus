/**
 * Timer tick styles (the last seconds of discussion).
 */
import { cineTick } from "#lib/audio/cinematic.ts";
import { SFX } from "#lib/audio/sfx.ts";
import { hiss } from "#lib/audio/noise.ts";
import { tone } from "#lib/audio/tone.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { t, tr } from "#lib/i18n/index.svelte.ts";

export const TKS: Record<string, string[]> = { calm: ["Calm", "Tic-tac discret, clopoțel la final"], clock: ["Ceas", "Tic-tac de ceas, sonerie la final"], cine: ["Cinematic", "Tic-tac lent, ca în film, gong la final"], tense: ["Tensionat", "Bătăi de inimă, alarmă la final"], silly: ["Haios", "Boing-uri, trombon trist la final"], off: ["Fără", "Timer mut, doar gongul"] };

export let CKF = 0;

type Tick = { t: (u?: boolean | number) => void; e: () => void };

export const TKF: Record<string, Tick> = {
    cine: { t: cineTick, e: () => SFX.gong() },
    clock: { t: (u?: boolean | number) => {
            CKF ^= 1;
            const h = CKF, g = u ? 1.25 : 1, f = h ? 2700 : 1900;
            hiss(.008, { ty: "highpass", f: 4500, q: .7, v: .5 * g, a: .0004 });
            hiss(.05, { f: f, q: 9, v: 1.1 * g, a: .0004 });
            hiss(.035, { f: h ? 1150 : 820, q: 6, v: .8 * g, a: .0004, at: .002 });
            hiss(.006, { ty: "highpass", f: 5000, q: .7, v: .22 * g, a: .0004, at: .03 });
            hiss(.03, { f: f * .8, q: 8, v: .35 * g, a: .0004, at: .03 });
        },
        e: () => [0, .9, 1.8].forEach((a, k) => {
            tone(k == 2 ? 392 : 523, 1.6, { v: .2, at: a, a: .003, lp: 3200, h: 2.76, det: .004, r: .5 });
            tone((k == 2 ? 392 : 523) * 2.01, .9, { v: .06, at: a, a: .003, lp: 4000, r: .5 });
        }) },
    calm: { t: (u?: boolean | number) => {
            tone(u ? 740 : 560, .09, { v: u ? .24 : .17, a: .002, lp: 2600, r: .15 });
            hiss(.02, { f: 2600, q: 2, v: u ? .1 : .07, a: .001 });
        }, e: () => [523, 659, 784].forEach((f, k) => tone(f, 1.3, { v: .13, at: k * .2, a: .01, lp: 1800, h: 2, r: .5 })) },
    tense: { t: (u?: boolean | number) => {
            tone(62, .13, { to: 46, sd: .1, v: u ? .55 : .36, a: .004 });
            tone(58, .15, { to: 42, sd: .12, v: .3, a: .004, at: .15 });
            if (u) {
                tone(1500, .05, { v: .07, a: .002, at: .3 });
            }
        }, e: () => {
            [0, .22, .44].forEach(a => tone(190, .2, { t: "sawtooth", to: 125, v: .17, at: a, a: .004, lp: 900 }));
            tone(55, .9, { to: 36, sd: .7, v: .45, a: .004, at: .66 });
        } },
    silly: { t: (u?: boolean | number) => tone(u ? 420 : 260, .14, { t: "triangle", to: u ? 980 : 560, sd: .11, v: .22, a: .004, lp: 2400 }), e: () => ([[311, 0, .28], [294, .3, .28], [277, .6, .28], [262, .9, .9]] as any[][]).forEach(([f, a, d], k) => tone(f, d, { t: "sawtooth", v: .14, at: a, a: .01, lp: 900, vib: k == 3 ? 6 : 0, to: k == 3 ? f * .8 : 0 })) }
};

export const TK = (u?: any) => {
    const k = TKF[state.tk];
    k?.t(u);
}, TKE = () => {
    const k = TKF[state.tk];
    (k ? k.e : SFX.gong)();
};

export const tkTxt = () => state.snd ? tr((TKS[state.tk] || TKS.calm)[1]) : t("stNeedSound");
