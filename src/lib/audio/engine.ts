/**
 * Web Audio context, master gain, compressor and reverb send. getAudioContext() returns null
 * when sound is off.
 */
import { state } from "#lib/stores/settings.svelte.ts";

export let audioCtx: AudioContext | undefined;
/** Set together with audioCtx by getAudioContext(); always read after it returned a context. */
export let masterGain!: GainNode;
export let reverbSend: GainNode | undefined;
/* audio engine: master gain (volume) -> compressor -> out, plus a small reverb send */

export const getAudioContext = () => {
    if (!state.snd) {
        return null;
    }
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const cp = audioCtx.createDynamicsCompressor();
            cp.threshold.value = -14;
            cp.ratio.value = 4;
            masterGain = audioCtx.createGain();
            masterGain.connect(cp);
            cp.connect(audioCtx.destination);
            if (!state.lite) {
                const ctx = audioCtx;
                (window.requestIdleCallback || ((f: () => void) => setTimeout(f, 400)))(() => {
                    if (ctx !== audioCtx || reverbSend) {
                        return;
                    }
                    try {
                        const L = ctx.sampleRate * 1.1 | 0, bf = ctx.createBuffer(2, L, ctx.sampleRate);
                        for (let c = 0; c < 2; c++) {
                            const d = bf.getChannelData(c);
                            for (let k = 0; k < L; k++) {
                                d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / L, 2.6);
                            }
                        }
                        const cv = ctx.createConvolver();
                        cv.buffer = bf;
                        const g = ctx.createGain();
                        g.gain.value = .25;
                        g.connect(cv);
                        cv.connect(cp);
                        reverbSend = g;
                    }
                    catch {
        // best effort: this must never break the game
    }
                }, { timeout: 2000 });
            }
        }
        /* "suspended" after a gesture-less start or a hidden page, "interrupted" on iOS after a call or Siri */
        if (audioCtx.state !== "running" && audioCtx.state !== "closed") {
            const r = audioCtx.resume();
            r?.catch(() => {
            });
        }
        masterGain.gain.value = state.vol;
        return audioCtx;
    }
    catch {
        return null;
    }
};

export const sendToReverb = (c: BaseAudioContext, g: AudioNode, r?: number) => {
    if (reverbSend && r) {
        const x = c.createGain();
        x.gain.value = r;
        g.connect(x);
        x.connect(reverbSend);
    }
};

/**
 * Stops the audio hardware while the page is hidden (battery; a locked phone keeps nothing playing
 * anyway) and wakes it on return. If the wake-up is refused outside a tap (iOS), the next tap or sound
 * resumes it through getAudioContext(). Called once from boot().
 */
export const initAudioLifecycle = () => {
    document.addEventListener("visibilitychange", () => {
        if (!audioCtx || audioCtx.state === "closed") {
            return;
        }
        const op = document.hidden ? audioCtx.suspend() : state.snd ? audioCtx.resume() : null;
        op?.catch(() => {
        });
    });
};
