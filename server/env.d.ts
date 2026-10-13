// Ambient types for the client word-list modules that the server imports (src/lib/data/words).
/// <reference types="vite/client" />
declare function requestIdleCallback(callback: () => void, options?: { timeout: number }): number;
