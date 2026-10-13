/**
 * Player helpers and the handlers of the players sheet (avatar, photo, name, add, remove + undo).
 */
import { flushSync } from "svelte";
import { state } from "#lib/stores/settings.svelte.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { popEl } from "#lib/animations/motion.ts";
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import { dismissToast, toast } from "#lib/components/ui/toast.svelte.ts";
import { applyStyle, closestIndex, codeToIndex, codeToLook, lookToCode, playerCode, playerLook, randomFreeCode, randomLook, type AvatarLook } from "#lib/components/players/avatar-parts.ts";

export const playerName = (i: number) => state.players[i].n.trim() || t("defPlayer", { n: i + 1 });

/** Everything needed to put a removed player back. */
interface RemovedPlayer {
    p: (typeof state.players)[number];
    i: number;
    sc: typeof state.scores;
    la: typeof state.last;
    k: number;
}

let removed: RemovedPlayer | null = null;

const popAvatar = (i: number) => {
    const pa = document.querySelector("#sr .bldp .av") ?? document.querySelectorAll("#sr .pick .av")[i];
    if (pa) {
        popEl(pa);
    }
};

/** Pencil button: focus the name field with the caret at the end. */
export function focusPlayerName(i: number) {
    const f = document.querySelector<HTMLInputElement>('#sr .field[data-i="' + i + '"]');
    if (!f) {
        return;
    }
    f.focus();
    try {
        const l = f.value.length;
        f.setSelectionRange(l, l);
    }
    catch {
        // best effort: this must never break the game
    }
    beep(520, .04);
    vibrate(8);
}

/** Stores a built look on player `i`: the code in `l`, and `a` follows when a legacy face matches (else `a` stays as it was). */
function applyLook(i: number, look: AvatarLook) {
    const p = state.players[i];
    if (!p) {
        return;
    }
    const code = lookToCode(look);
    const legacy = codeToIndex(code);
    p.l = code;
    if (legacy !== null) {
        p.a = legacy;
    }
}

/** One choice in the avatar builder (a hat, a skin tone, ...). Applies live; autosave stores it. */
export function setAvatarPart<K extends keyof AvatarLook>(i: number, part: K, value: AvatarLook[K]) {
    if (!state.players[i]) {
        return;
    }
    applyLook(i, { ...playerLook(state.players[i]), [part]: value });
    flushSync();
    popAvatar(i);
    beep(600, .05);
    vibrate(10);
}

/** One of the quick styles of the avatar builder (classic, man, woman, ...): sets several parts at once and keeps the rest. */
export function setAvatarStyle(i: number, style: number) {
    if (!state.players[i]) {
        return;
    }
    applyLook(i, applyStyle(playerLook(state.players[i]), style));
    flushSync();
    popAvatar(i);
    beep(600, .05);
    vibrate(10);
}

/** The dice button of the avatar builder. */
export function randomizeAvatar(i: number) {
    if (!state.players[i]) {
        return;
    }
    applyLook(i, randomLook());
    flushSync();
    popAvatar(i);
    beep(660, .06);
    vibrate(12);
}

/** True when another player has exactly the same drawn face (same look code). Only a soft hint; duplicates are allowed. */
export function hasTwinLook(i: number): boolean {
    const p = state.players[i];
    return !!p && state.players.some((o, j) => j !== i && playerCode(o) === playerCode(p));
}

export function removePlayerPhoto(i: number) {
    delete state.players[i].ph;
    beep(380, .05);
    vibrate(10);
}

/** Crops the chosen image to a square 160 px JPEG and stores it as the player's photo. */
export function choosePhoto(i: number, input: HTMLInputElement) {
    const f = input.files && input.files[0];
    if (!f || !state.players[i]) {
        return;
    }
    const rd = new FileReader();
    rd.onload = () => {
        const im = new Image();
        im.onload = () => {
            try {
                const side = Math.min(im.width, im.height), sx = (im.width - side) / 2, sy = (im.height - side) * .3, c = document.createElement("canvas");
                c.width = c.height = 160;
                c.getContext("2d")!.drawImage(im, sx, sy, side, side, 0, 0, 160, 160);
                state.players[i].ph = c.toDataURL("image/jpeg", .82);
                flushSync();
                popAvatar(i);
                beep(700, .07);
                vibrate(15);
            }
            catch {
        // best effort: this must never break the game
    }
        };
        im.src = rd.result as string;
    };
    rd.readAsDataURL(f);
}

export const MAX_PLAYERS = 12;

const nameField = (i: number) => document.querySelector<HTMLInputElement>('#sr .field[data-i="' + i + '"]');

/** Brings player `i`'s row into view (inside the scrolling list of the players sheet) and, with `focus`, puts the caret in the name field. */
function revealPlayer(i: number, focus: boolean) {
    const f = nameField(i);
    if (!f) {
        return;
    }
    f.closest(".cr")?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    if (focus) {
        f.focus({ preventScroll: true });
    }
}

/** Adds a player (optionally with a name). With `focus` the new row scrolls into view and its name field gets the caret. */
export function addPlayer(opts: { name?: string; focus?: boolean } = {}) {
    const l = randomFreeCode(state.players.map(playerCode));
    state.players.push({ n: opts.name ?? "", a: closestIndex(codeToLook(l)), l });
    beep(620, .06);
    vibrate(12);
    const i = state.players.length - 1;
    flushSync();
    revealPlayer(i, !!opts.focus);
    return i;
}

/** Enter in a name / title field: go to the next player's name, or add one after the last (up to MAX_PLAYERS; at the limit the keyboard closes). */
export function nextPlayer(i: number, e: KeyboardEvent) {
    if (e.key !== "Enter" || e.isComposing) {
        return;
    }
    e.preventDefault();
    if (i < state.players.length - 1) {
        revealPlayer(i + 1, true);
    }
    else if (state.players.length < MAX_PLAYERS) {
        addPlayer({ focus: true });
    }
    else {
        (e.target as HTMLElement).blur();
    }
}

/**
 * Moves player `from` to position `to`; the players in between shift by one. Position is the order the phone is passed in.
 * Scores and last round's intruders are saved BY POSITION, so they are re-keyed to follow the people: nobody inherits
 * another player's points. Returns false when nothing moved.
 */
export function movePlayer(from: number, to: number): boolean {
    const n = state.players.length;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) {
        return false;
    }
    // Where a player who stood at position `i` stands after the move.
    const at = (i: number) => (i === from ? to : from < to ? (i > from && i <= to ? i - 1 : i) : i >= to && i < from ? i + 1 : i);
    const [p] = state.players.splice(from, 1);
    state.players.splice(to, 0, p);
    const sc: typeof state.scores = {};
    for (const key of Object.keys(state.scores)) {
        sc[at(+key)] = state.scores[key];
    }
    state.scores = sc;
    state.last = state.last.map((i: unknown) => (typeof i === "number" ? at(i) : i));
    return true;
}

/** Removes player `v` (scores shift down, the toast offers an undo). The row's exit is the `out:` transition in PlayersSheet. */
export function removePlayer(v: number) {
    if (!prefersReducedMotion()) {
        beep(380, .05);
        vibrate(10);
    }
    const gone: RemovedPlayer = { p: state.players[v], i: v, sc: { ...state.scores }, la: [...state.last], k: state.k };
    const ae = document.activeElement;
    if (ae && ae.matches && ae.matches(".pl .field")) {
        (ae as HTMLElement).blur();
    }
    state.players.splice(v, 1);
    const q: Record<number, number> = {};
    Object.keys(state.scores).forEach(key => {
        const k = +key;
        if (k < v) {
            q[k] = state.scores[k];
        }
        else if (k > v) {
            q[k - 1] = state.scores[k];
        }
    });
    state.scores = q;
    state.last = [];
    const mx = Math.max(1, (state.players.length - 1) >> 1);
    if (state.k > mx) {
        state.k = mx;
    }
    removed = gone;
    toast(t("plGone", { name: gone.p.n.trim() || t("defPlayer", { n: gone.i + 1 }) }), { action: t("plUndo"), onaction: undoRemove });
}

/** "Anulează" on the removal toast. */
export function undoRemove() {
    const u = removed;
    if (!u) {
        return;
    }
    removed = null;
    state.players.splice(Math.min(u.i, state.players.length), 0, u.p);
    state.scores = u.sc;
    state.last = u.la;
    state.k = u.k;
    dismissToast();
    beep(620, .06);
    vibrate(12);
}
