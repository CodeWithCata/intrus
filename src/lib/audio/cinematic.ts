/**
 * Cinematic tick/tock samples loaded lazily from static/audio.
 */
/** tick / tock clips (extracted from the original base64 data into static/audio) */

export const CINE = ["/audio/tick.mp3", "/audio/tock.mp3"];
import { masterGain, getAudioContext, sendToReverb } from "#lib/audio/engine.ts";

export const CNB: AudioBuffer[] = [];
export let CNL = 0, CNH = 0;

export const cineLoad = () => {
    const c = getAudioContext();
    if (!c || CNL) {
        return;
    }
    CNL = 1;
    CINE.forEach((u, i) => {
        fetch(u).then(r => r.arrayBuffer()).then(buf => c.decodeAudioData(buf, (b: AudioBuffer) => {
            CNB[i] = b;
        }, () => {
            CNL = 0;
        })).catch(() => {
            CNL = 0;
        });
    });
};

export const cineTick = (u?: any) => {
    const c = getAudioContext();
    if (!c) {
        return;
    }
    cineLoad();
    CNH ^= 1;
    const b = CNB[CNH];
    if (!b) {
        return;
    }
    try {
        const s = c.createBufferSource();
        s.buffer = b;
        s.playbackRate.value = u ? 1.08 : 1;
        const g = c.createGain();
        g.gain.value = u ? 1.2 : .85;
        s.connect(g);
        g.connect(masterGain);
        sendToReverb(c, g, .12);
        s.start();
    }
    catch {
        // best effort: this must never break the game
    }
};
