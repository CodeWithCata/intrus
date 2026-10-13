/**
 * Noise-based sound primitives (hiss).
 */
import { masterGain, getAudioContext, sendToReverb } from "#lib/audio/engine.ts";

/* hiss: filtered noise burst. o = {ty:filter type, f:freq, to:end freq, q, v, a, at, r} */

export let NBC: BaseAudioContext | undefined, NBF: AudioBuffer | undefined;

export const noise = (c: BaseAudioContext) => {
    if (NBC !== c || !NBF) {
        NBC = c;
        const n = c.sampleRate * 2 | 0, b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
        for (let k = 0; k < n; k++) {
            a[k] = Math.random() * 2 - 1;
        }
        NBF = b;
    }
    return NBF;
};

export const hiss = (d = .1, o: any = {}) => {
    const c = getAudioContext();
    if (!c) {
        return;
    }
    try {
        const t = c.currentTime + (o.at || 0), off = Math.random() * Math.max(0, 1.9 - d);
        const sr = c.createBufferSource();
        sr.buffer = noise(c);
        const fl = c.createBiquadFilter();
        fl.type = o.ty || "bandpass";
        fl.Q.value = o.q || 1.1;
        fl.frequency.setValueAtTime(o.f || 2000, t);
        if (o.to) {
            fl.frequency.exponentialRampToValueAtTime(o.to, t + d);
        }
        const g = c.createGain();
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(.0002, o.v ?? .12), t + (o.a ?? .008));
        g.gain.exponentialRampToValueAtTime(.0001, t + d);
        sr.connect(fl);
        fl.connect(g);
        g.connect(masterGain);
        sendToReverb(c, g, o.r);
        sr.start(t, off);
        sr.stop(t + d + .02);
    }
    catch {
        // best effort: this must never break the game
    }
};
