/**
 * Toasts: `toast(message, { action, onaction, duration })` shows one message (a new one replaces the old one)
 * for 5 s (or `duration` ms). Toast.svelte (mounted once by App.svelte) renders the newest entry of `toasts`.
 */
export interface ToastItem {
    id: number;
    message: string;
    action?: string;
    onaction?: () => void;
}

export const toasts: ToastItem[] = $state([]);

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function dismissToast() {
    clearTimeout(timer);
    toasts.length = 0;
}

export function toast(message: string, options: { action?: string; onaction?: () => void; duration?: number } = {}) {
    clearTimeout(timer);
    toasts.length = 0;
    toasts.push({ id: ++seq, message, action: options.action, onaction: options.onaction });
    timer = setTimeout(dismissToast, options.duration ?? 5000);
}
