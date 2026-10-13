/** "A new version is ready": `update.ready` is set by utils/sw-update.ts, UpdateBanner.svelte shows the button. */
export const update = $state({ ready: false, busy: false });
