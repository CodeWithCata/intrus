/**
 * Handlers of the online sheet's buttons (the room itself lives in online/client.svelte.ts).
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { normalizeCode } from "#lib/online/room.ts";
import { roomLink } from "#lib/online/client.svelte.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";

/** "Creează" (0) / "Intră" (1). */
export function setOnlineMode(i: number) {
    state.ol = i;
    beep(560, .05);
    vibrate(10);
}

/** The code field keeps only A-Z and 0-9, upper-cased, at most 6 characters. */
export function typeRoomCode(input: HTMLInputElement) {
    state.code = normalizeCode(input.value);
    input.value = state.code;
}

/** Copies the invitation link; if the browser refuses, says so instead of pretending. */
export async function copyRoomLink(): Promise<boolean> {
    let ok = false;
    try {
        await navigator.clipboard.writeText(roomLink());
        ok = true;
    }
    catch {
        toast(t("olCopyFail"));
    }
    beep(660, .06);
    vibrate(15);
    return ok;
}
