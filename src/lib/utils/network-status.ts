/**
 * Tells the player when the connection drops and when it comes back, in a toast. It stays quiet during a round on one
 * phone (the game does not need the internet there); it speaks on the setup screen and inside an online room.
 * The "back online" message only follows an "offline" one that was actually shown.
 */
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import { nav } from "#lib/stores/nav.svelte.ts";
import { inRoom } from "#lib/online/client.svelte.ts";

let announced = false;

export function initNetworkStatus(): void {
    addEventListener("offline", () => {
        const room = inRoom();
        if (!room && nav.screen !== "setup") {
            return;
        }
        announced = true;
        toast(t(room ? "netOfflineRoom" : "netOffline"));
    });
    addEventListener("online", () => {
        if (!announced) {
            return;
        }
        announced = false;
        toast(t("netBack"));
    });
}
