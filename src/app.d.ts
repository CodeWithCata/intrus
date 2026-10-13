// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {}
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
export {};
