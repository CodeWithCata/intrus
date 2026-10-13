/**
 * Synth primitives: tone() (oscillator note with options) and beep().
 */
import { masterGain, getAudioContext, sendToReverb } from "#lib/audio/engine.ts";

/* tone: o = {t:type, v:peak, a:attack, at:delay, lp:lowpass, h:harmonic ratio, det:detune, to:slide target, sd:slide time, vib:vibrato Hz, r:reverb} */

export const tone = (f?: any, d = .12, o: any = {}) => {
    const c = getAudioContext();
    if (!c) {
        return;
    }
    try {
        const t = c.currentTime + (o.at || 0), ty = o.t || "sine", v = o.v ?? .2;
        const g = c.createGain(), fl = c.createBiquadFilter();
        fl.type = "lowpass";
        fl.frequency.value = o.lp || Math.min(9000, f * 6);
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t + (o.a || .006));
        g.gain.exponentialRampToValueAtTime(.0001, t + d);
        fl.connect(g);
        g.connect(masterGain);
        sendToReverb(c, g, o.r);
        const mk = (fr: any, lv: any, t2?: any) => {
            const os = c.createOscillator();
            os.type = t2 || ty;
            os.frequency.setValueAtTime(fr, t);
            if (o.to) {
                os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * fr / f), t + (o.sd || d));
            }
            if (o.vib) {
                const l = c.createOscillator(), lg = c.createGain();
                l.frequency.value = o.vib;
                lg.gain.value = fr * .025;
                l.connect(lg);
                lg.connect(os.frequency);
                l.start(t);
                l.stop(t + d + .05);
            }
            const q = c.createGain();
            q.gain.value = lv;
            os.connect(q);
            q.connect(fl);
            os.start(t);
            os.stop(t + d + .05);
        };
        mk(f, 1);
        if (o.h) {
            mk(f * o.h, .3, "sine");
        }
        if (o.det) {
            mk(f * (1 + o.det), .6);
        }
    }
    catch {
        // best effort: this must never break the game
    }
};
/* generic UI beep keeps its old signature but now has a softer, richer voice */

export const beep = (f = 520, d = .12, _type = "sine") => {
    tone(f * .8, Math.min(d, .1), { v: .13, a: .003, lp: f * 2, r: .1 });
};
