/**
 * Sharing a custom word list: link (compressed into the URL hash), QR code, or file; and importing one back.
 * Pure (no stores, no DOM besides the standard CompressionStream / TextEncoder / btoa), so it is unit-tested with hostile input.
 *
 * Everything that comes in is untrusted: it is parsed with JSON.parse (never evaluated), only the known keys are read
 * (own properties only, so `__proto__` / `constructor` tricks do nothing), every string is cleaned and capped, and the result is
 * plain text that the UI renders as text. The UI always shows a confirm sheet before adding anything: nothing is auto-imported.
 */

export const LIMITS = { name: 40, words: 300, word: 40, payload: 8192, token: 12000 } as const;

export interface SharedList {
    name: string;
    words: string[];
}

export type ShareError = "empty" | "too-big" | "format" | "version" | "no-words";

export type ParseResult = { ok: true; list: SharedList; dropped: number } | { ok: false; reason: ShareError };

/** Control characters, zero-width and bidi override characters: stripped from every imported string. */
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const UNSAFE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g;

/** Plain-text version of an untrusted string: NFC, no control characters, no `,` or `|` (they split custom words), one space between words, at most `max` characters. */
export function cleanText(s: unknown, max: number): string {
    if (typeof s !== "string") {
        return "";
    }
    const t = s.normalize("NFC").replace(UNSAFE, "").replace(/[,|]/g, " ").replace(/\s+/g, " ").trim();
    return Array.from(t).slice(0, max).join("").trim();
}

const own = (o: object, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? (o as Record<string, unknown>)[k] : undefined);

/** Validates a parsed value against `{ v: 1, name, words[] }`. Unknown keys are ignored. */
export function validateList(raw: unknown): ParseResult {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, reason: "format" };
    }
    if (own(raw, "v") !== 1) {
        return { ok: false, reason: "version" };
    }
    const w = own(raw, "words");
    if (!Array.isArray(w)) {
        return { ok: false, reason: "format" };
    }
    if (w.length > LIMITS.words) {
        return { ok: false, reason: "too-big" };
    }
    const seen = new Set<string>();
    const words: string[] = [];
    let dropped = 0;
    for (const x of w) {
        const raw2 = typeof x === "string" ? x : "";
        const c = cleanText(raw2, LIMITS.word + 1);
        // a word longer than the cap is dropped, not cut: a cut word would be a different word
        if (!c || Array.from(c).length > LIMITS.word || seen.has(c.toLowerCase())) {
            dropped++;
            continue;
        }
        seen.add(c.toLowerCase());
        words.push(c);
    }
    if (!words.length) {
        return { ok: false, reason: "no-words" };
    }
    const name = cleanText(own(raw, "name"), LIMITS.name) || "Listă importată";
    return { ok: true, list: { name, words }, dropped };
}

/** Parses the JSON text of a list (a file, or a decompressed link). */
export function parseList(text: string): ParseResult {
    if (typeof text !== "string" || !text.trim()) {
        return { ok: false, reason: "empty" };
    }
    if (text.length > LIMITS.payload) {
        return { ok: false, reason: "too-big" };
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    }
    catch {
        return { ok: false, reason: "format" };
    }
    return validateList(raw);
}

/** The JSON text of a list, in the format parseList() reads (also what the exported file contains). */
export function serializeList(list: SharedList): string {
    return JSON.stringify({ v: 1, name: cleanText(list.name, LIMITS.name), words: list.words.map(x => cleanText(x, LIMITS.word)).filter(Boolean).slice(0, LIMITS.words) });
}

/** The words of a saved custom list (`"word|category|hint, word, ..."`), words only. */
export function wordsOfSaved(w: string): string[] {
    return w.split(",").map(s => s.split("|")[0].trim()).filter(Boolean);
}

/** A name that does not collide (case-insensitive) with `existing`: "Nume", "Nume (2)", "Nume (3)", ... within the name cap. */
export function uniqueName(name: string, existing: readonly string[]): string {
    const taken = new Set(existing.map(x => x.toLowerCase()));
    if (!taken.has(name.toLowerCase())) {
        return name;
    }
    for (let i = 2; i < 1000; i++) {
        const suffix = ` (${i})`;
        const cand = Array.from(name).slice(0, LIMITS.name - suffix.length).join("").trim() + suffix;
        if (!taken.has(cand.toLowerCase())) {
            return cand;
        }
    }
    return name;
}

/* ---------- link token: base64url of (deflate-raw | plain) bytes ---------- */

const toB64 = (bytes: Uint8Array): string => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64 = (t: string): Uint8Array | null => {
    if (!/^[A-Za-z0-9_-]*$/.test(t)) {
        return null;
    }
    try {
        const bin = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
        return Uint8Array.from(bin, c => c.charCodeAt(0));
    }
    catch {
        return null;
    }
};

const hasStreams = (): boolean => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

async function pump(stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }, input: Uint8Array, cap: number): Promise<Uint8Array | null> {
    const w = stream.writable.getWriter();
    w.write(input).catch(() => {});
    w.close().catch(() => {});
    const r = stream.readable.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await r.read();
            if (done) {
                break;
            }
            total += value.length;
            if (total > cap) {
                await r.cancel().catch(() => {});
                return null; // a compression bomb: stop reading
            }
            parts.push(value);
        }
    }
    catch {
        return null;
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

/** The text that goes after `#l=`: "1." + deflate-raw, or "0." + plain when the browser has no CompressionStream. */
export async function encodeToken(list: SharedList): Promise<string> {
    const bytes = new TextEncoder().encode(serializeList(list));
    if (hasStreams()) {
        const z = await pump(new CompressionStream("deflate-raw") as never, bytes, LIMITS.payload * 2);
        if (z) {
            return "1." + toB64(z);
        }
    }
    return "0." + toB64(bytes);
}

/** Decodes and validates a token. Never throws. */
export async function decodeToken(token: string): Promise<ParseResult> {
    if (typeof token !== "string" || !token) {
        return { ok: false, reason: "empty" };
    }
    if (token.length > LIMITS.token) {
        return { ok: false, reason: "too-big" };
    }
    const kind = token.slice(0, 2), bytes = fromB64(token.slice(2));
    if (!bytes || (kind !== "0." && kind !== "1.")) {
        return { ok: false, reason: "format" };
    }
    let text: Uint8Array | null = bytes;
    if (kind === "1.") {
        text = hasStreams() ? await pump(new DecompressionStream("deflate-raw") as never, bytes, LIMITS.payload) : null;
    }
    if (!text) {
        return { ok: false, reason: "format" };
    }
    if (text.length > LIMITS.payload) {
        return { ok: false, reason: "too-big" };
    }
    return parseList(new TextDecoder("utf-8", { fatal: false }).decode(text));
}

/** The token inside whatever was pasted: a whole link, `#l=...`, `l=...` or the bare token. Null when there is nothing usable. */
export function tokenFromInput(input: string): string | null {
    const s = String(input ?? "").trim();
    if (!s || s.length > LIMITS.token + 200) {
        return null;
    }
    const m = s.match(/[#?&]l=([A-Za-z0-9_.-]+)/) ?? s.match(/^l=([A-Za-z0-9_.-]+)$/) ?? s.match(/^([01]\.[A-Za-z0-9_-]+)$/);
    return m ? m[1] : null;
}

/** The link that opens the app on the import sheet. `base` is the app's own URL without a hash. */
export const makeLink = (base: string, token: string): string => `${base.replace(/#.*$/, "")}#l=${token}`;

/** A safe file name for the exported list: ASCII letters, digits and dashes. */
export function fileName(name: string): string {
    const slug = cleanText(name, LIMITS.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `${slug || "lista"}.intrus.json`;
}
