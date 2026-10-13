/**
 * Export / import of custom word lists (link, QR, file). The format, the caps and the cleaning of imported text live in
 * game/list-share.ts (pure, unit-tested). Here: the state of the two sheets, the share / download calls, and the confirm step.
 * Nothing is ever imported without the confirm sheet: a link, a paste or a file only fills `share.pending`.
 * No network: everything is in the URL hash, the pasted text or the file the player picked.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { currentWordLists, readWordLists, useWordList } from "#lib/stores/wordlists.svelte.ts";
import { openSheet, closeSheet } from "#lib/components/ui/sheets.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import { uniqueId } from "#lib/utils/id.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { LIMITS, decodeToken, encodeToken, fileName, makeLink, parseList, serializeList, tokenFromInput, uniqueName, wordsOfSaved, type ParseResult, type SharedList, type ShareError } from "#lib/game/list-share.ts";

interface ListRow {
    id: string;
    nm: string;
    w: string;
}

export const share = $state<{
    /** The list being exported (lshare sheet). */
    list: SharedList | null;
    link: string;
    /** A parsed import waiting for the player's confirmation (limport sheet). */
    pending: { list: SharedList; dropped: number } | null;
    paste: string;
    /** What to do when a list with the same name exists. */
    onClash: "both" | "replace";
}>({ list: null, link: "", pending: null, paste: "", onClash: "both" });

/** QR codes made by our own encoder hold at most this many bytes. */
export const QR_BYTES = 180;

export const qrFits = (link: string): boolean => new TextEncoder().encode(link).length <= QR_BYTES;

const message = (reason: ShareError): string => {
    switch (reason) {
        case "empty": return t("lsErrEmpty");
        case "too-big": return t("lsErrBig");
        case "version": return t("lsErrVersion");
        case "no-words": return t("lsErrNoWords");
        default: return t("lsErrFormat");
    }
};

const appBase = () => location.origin + location.pathname;

/** Opens the export sheet for a saved list. */
export async function openShare(id: string) {
    const l = (readWordLists() as unknown as ListRow[]).find(x => x.id === id);
    if (!l) {
        return;
    }
    share.list = { name: l.nm, words: wordsOfSaved(l.w) };
    share.link = makeLink(appBase(), await encodeToken(share.list));
    beep(560, .05);
    vibrate(10);
    openSheet("lshare");
}

export async function copyLink() {
    try {
        await navigator.clipboard.writeText(share.link);
        toast(t("mpLinkCopied"));
    }
    catch {
        toast(share.link, { duration: 9000 });
    }
}

/** The system share sheet with the link, or a copy when the browser has none. */
export async function sendLink() {
    if (navigator.share && share.list) {
        try {
            await navigator.share({ title: share.list.name, url: share.link });
            return;
        }
        catch (e) {
            if ((e as DOMException)?.name === "AbortError") {
                return;
            }
        }
    }
    await copyLink();
}

/** The list as a file: through the share sheet when the browser can share files, otherwise a download. */
export async function sendFile() {
    if (!share.list) {
        return;
    }
    const name = fileName(share.list.name), text = serializeList(share.list);
    const file = new File([text], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: share.list.name });
            return;
        }
        catch (e) {
            if ((e as DOMException)?.name === "AbortError") {
                return;
            }
        }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t("lsSaved"));
}

/** Shows the confirm step for a parse result, or says why the list cannot be imported. */
function stage(r: ParseResult) {
    if (!r.ok) {
        toast(message(r.reason));
        vibrate([40, 40]);
        return;
    }
    share.pending = { list: r.list, dropped: r.dropped };
    share.onClash = "both";
    openSheet("limport");
}

export function openImport() {
    share.pending = null;
    share.paste = "";
    openSheet("limport");
}

/** From the paste field: a whole link, `#l=...` or the bare code. */
export async function importPasted() {
    const text = share.paste.trim();
    if (text.startsWith("{")) {
        stage(parseList(text)); // someone pasted the file's text
        return;
    }
    const tok = tokenFromInput(text);
    stage(tok ? await decodeToken(tok) : { ok: false, reason: text ? "format" : "empty" });
}

/** From the file picker. The size is checked before the file is read. */
export async function importFile(file: File | undefined) {
    if (!file) {
        return;
    }
    if (file.size > LIMITS.payload) {
        toast(message("too-big"));
        return;
    }
    stage(parseList(await file.text()));
}

/** The app was opened from a link with `#l=...`: reads it once and clears it from the address bar. Only on the setup screen. */
export async function importFromHash(): Promise<void> {
    const m = location.hash.match(/^#l=([A-Za-z0-9_.-]+)$/);
    if (!m) {
        return;
    }
    history.replaceState(null, "", location.pathname + location.search);
    stage(await decodeToken(m[1]));
}

/** The player confirmed: adds the list (or replaces the one with the same name) and selects it. */
export function confirmImport() {
    const p = share.pending;
    if (!p) {
        return;
    }
    const lists = currentWordLists() as unknown as ListRow[];
    const same = lists.find(l => l.nm.toLowerCase() === p.list.name.toLowerCase());
    const w = p.list.words.join(", ");
    let id: string, name: string;
    if (same && share.onClash === "replace") {
        same.w = w;
        id = same.id;
        name = same.nm;
    }
    else {
        name = uniqueName(p.list.name, lists.map(l => l.nm));
        id = uniqueId();
        lists.push({ id, nm: name, w });
    }
    share.pending = null;
    useWordList(id);
    state.sheet = "cats";
    beep(660, .06);
    vibrate(15);
    toast(t("lsAdded", { name }));
}

export const cancelImport = () => {
    share.pending = null;
    closeSheet();
};

/** True when the pending list has the same name as a saved one (the confirm sheet then asks what to do). */
export const clashes = (name: string): boolean => (readWordLists() as unknown as ListRow[]).some(l => l.nm.toLowerCase() === name.toLowerCase());
