// Shared test harness: a jsdom document that looks like the real app shell (sprite included).
import { readFileSync } from "node:fs";
import { vi } from "vitest";

/** First element matching `selector` whose trimmed text is `text` (buttons no longer carry a data-a to select by). */
export const byText = (selector: string, text: string) =>
  [...document.querySelectorAll(selector)].find((e) => e.textContent?.trim() === text) as HTMLElement | undefined;

/** `state` is a $state proxy, which structuredClone refuses: copy it through JSON instead. */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function installShell() {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({
    /* reduced motion: sheet exit transitions have duration 0 (no Web Animations in jsdom) */ matches: query.includes("prefers-reduced-motion"), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false
  }));
  window.scrollTo = (() => {}) as any;
  // jsdom has no Web Animations: Card.svelte and the settings code call element.getAnimations() to cancel running animations
  if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => [];
  // The real icon sprite from src/app.html, so icon() takes the same path as in the browser.
  const html = readFileSync("src/app.html", "utf8");
  const sprite = html.match(/<svg class="sprite"[\s\S]*?<\/svg>\s*(?=<div style="display:contents">)/)?.[0] ?? "";
  document.body.innerHTML = `${sprite}<div id="app"></div><div id="sr"></div>`;
}
