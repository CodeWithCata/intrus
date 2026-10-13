/**
 * Card designs (CARD_DESIGNS: [id, name, roundsNeeded (0 = always available), ...]) and their SVG backs.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { BACK } from "#lib/components/game/art.ts";

/* ===== card designs, timer styles, player titles ===== */

export const ALL_UNLOCKED = /[?&]unlock=1/.test(location.search);

export const CARD_DESIGNS = ([["classic", "Clasic", 0], ["comic", "Benzi", 0], ["noir", "Noir", 0], ["neon", "Neon", 0], ["hand", "De mână", 0], ["dosar", "Dosar", 0], ["aur", "Aur", 0], ["glitch", "Glitch", 0]] as any[][]);

/** Every card design is available from the start (no rounds needed). Kept as a function so callers need no change. */
export const lk = (_d?: any) => false;

export const rn = (n?: any) => n == 1 ? "rundă" : (n % 100 < 20 && n % 100 > 0) ? "runde" : "de runde";

export const SB = (a?: any, b?: any, n?: any) => Array.from({ length: n * 2 }, (_, i) => {
    const t = i * Math.PI / n, r = i % 2 ? a : b;
    return (144 + Math.cos(t) * r).toFixed(1) + "," + (192 + Math.sin(t) * r).toFixed(1);
}).join(" ");

export const bkw = (bg?: any, x?: any) => `<svg class="back" viewBox="0 0 288 384" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="288" height="384" fill="${bg}"/>${x}</svg>`;

export const QM = (c?: any, z?: any, y?: any, f = "Plus Jakarta Sans,sans-serif", w = 800, x = 144) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${f}" font-weight="${w}" font-size="${z}" fill="${c}">?</text>`;

export const CDB: Record<string, () => string> = {
    classic: () => BACK,
    comic: () => bkw("#FFD93B", `<defs><pattern id="cdh" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2.4" fill="#111" fill-opacity=".22"/></pattern></defs><rect width="288" height="384" fill="url(#cdh)"/><polygon points="${SB(70, 120, 12)}" fill="#E3002B" stroke="#111" stroke-width="6" stroke-linejoin="round"/>${QM("#fff", 130, 238, "Bangers,Anton,sans-serif", 400)}<rect x="10" y="10" width="268" height="364" rx="18" fill="none" stroke="#111" stroke-width="8"/>`),
    noir: () => bkw("#060606", `${[...Array(14)].map((_, i) => `<rect x="-30" y="${i * 32 - 10}" width="350" height="9" fill="#fff" fill-opacity=".08" transform="rotate(-12 144 192)"/>`).join("")}<rect x="16" y="16" width="256" height="352" rx="18" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>${QM("#fff", 140, 246, "Georgia,serif", 700)}<circle cx="144" cy="318" r="5" fill="#D8002B"/>`),
    neon: () => bkw("#0B0720", `<defs><filter id="cdn"><feGaussianBlur stdDeviation="7"/></filter></defs>${[0, 1, 2, 3, 4, 5].map(k => `<path d="M0 ${230 + k * k * 5.5}H288" stroke="#FF4FD8" stroke-opacity=".55"/>`).join("")}${[-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => `<path d="M${144 + k * 14} 226L${144 + k * 58} 384" stroke="#FF4FD8" stroke-opacity=".45"/>`).join("")}<g filter="url(#cdn)" opacity=".9">${QM("#7DF9FF", 150, 200)}</g>${QM("#7DF9FF", 150, 200)}<rect x="14" y="14" width="260" height="356" rx="20" fill="none" stroke="#7DF9FF" stroke-width="3"/>`),
    hand: () => bkw("#FBF6E6", `${[...Array(13)].map((_, i) => `<path d="M0 ${40 + i * 28}H288" stroke="#6E8CD8" stroke-opacity=".3"/>`).join("")}<path d="M40 0V384" stroke="#DC4A4A" stroke-opacity=".5" stroke-width="2"/><path d="M14 22Q60 12 140 18T274 16Q280 100 272 190T276 366Q200 372 140 366T14 370Q10 280 16 190T14 22z" fill="none" stroke="#1F2A5C" stroke-width="3" stroke-linecap="round"/><g transform="rotate(-8 144 200)">${QM("#D8002B", 190, 250, "Caveat,cursive", 700)}</g>`),
    dosar: () => bkw("#C9A66B", `<path d="M0 34H288" stroke="#8B6B35" stroke-opacity=".5"/><rect x="34" y="96" width="220" height="64" fill="#F3EBD8" stroke="#8B6B35"/><text x="144" y="138" text-anchor="middle" font-family="Courier New,monospace" font-weight="700" font-size="30" fill="#2B2418">DOSAR ?</text><g transform="rotate(-10 144 250)"><rect x="40" y="218" width="208" height="62" rx="4" fill="none" stroke="#B3001F" stroke-width="5"/><text x="144" y="260" text-anchor="middle" font-family="Courier New,monospace" font-weight="700" font-size="28" fill="#B3001F">CONFIDENȚIAL</text></g>`),
    aur: () => bkw("#0A0800", `<defs><linearGradient id="cda" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7E7A3"/><stop offset=".45" stop-color="#D4A72C"/><stop offset=".7" stop-color="#F7E7A3"/><stop offset="1" stop-color="#B8860B"/></linearGradient></defs><rect x="14" y="14" width="260" height="356" rx="20" fill="none" stroke="url(#cda)" stroke-width="5"/><rect x="28" y="28" width="232" height="328" rx="12" fill="none" stroke="url(#cda)" stroke-width="1.5"/><path d="M144 80l52 112-52 112-52-112z" fill="none" stroke="url(#cda)" stroke-width="3"/>${QM("url(#cda)", 120, 230)}`),
    glitch: () => bkw("#06070A", `<defs><pattern id="cdg" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#0f0" fill-opacity=".06"/></pattern></defs><rect width="288" height="384" fill="url(#cdg)"/>${QM("#05D9E8", 160, 246, undefined, 800, 134)}${QM("#FF2A6D", 160, 246, undefined, 800, 154)}${QM("#fff", 160, 246)}<rect y="120" width="288" height="8" fill="#05D9E8" fill-opacity=".35"/><rect x="40" y="290" width="248" height="5" fill="#FF2A6D" fill-opacity=".4"/>`)
};

export const cdBack = () => (CDB[state.cd] || CDB.classic)();
