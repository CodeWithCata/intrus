/**
 * Takes the phone screenshots Chrome shows in its install dialog, writes them to static/screenshots/ and lists them in
 * static/manifest.json ("screenshots"). Run it whenever the look of the app changes:
 *
 *   pnpm build && pnpm preview        (terminal 1: serves the build on http://localhost:4173)
 *   pnpm screenshots                  (terminal 2)
 *
 * BASE_URL=http://localhost:5173 pnpm screenshots uses the dev server instead.
 * NOT VERIFIED when written (no browser could be installed in that environment): if a shot looks wrong, adjust SHOTS below.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = "static/screenshots";
/** CSS pixels of a tall phone. Chrome wants 320-3840 px per side and a long side of at most 2.3x the short one (915 / 412 = 2.22). */
const VIEW = { width: 412, height: 915 };
const SCALE = 2;
const KEY = "intrus.v6"; // same key as src/lib/storage/keys.ts

const PLAYERS = ["Ana", "Radu", "Maria", "Vlad", "Ioana"].map((n, a) => ({ n, a }));

const SHOTS = [
  { file: "intro.png", label: "Jocul în care unul dintre voi minte", seed: null },
  { file: "setup.png", label: "Alege jucătorii și începe runda", seed: { seen: true, players: PLAYERS } }
];

/** Waits until the launch splash is gone (or gives up after a while: a screenshot of a late splash is still a screenshot). */
async function settle(page) {
  await page
    .waitForFunction(() => {
      const el = document.getElementById("splash");
      return !el || el.classList.contains("out") || getComputedStyle(el).display === "none";
    }, undefined, { timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const taken = [];

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    locale: "ro-RO",
    serviceWorkers: "block"
  });
  if (shot.seed) {
    await context.addInitScript(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, shot.seed]);
  }
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/${shot.file}` });
  taken.push(shot);
  console.log("saved", `${OUT}/${shot.file}`);
  await context.close();
}
await browser.close();

const manifestPath = "static/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.screenshots = taken.map(s => ({
  src: `/screenshots/${s.file}`,
  sizes: `${VIEW.width * SCALE}x${VIEW.height * SCALE}`,
  type: "image/png",
  form_factor: "narrow",
  label: s.label
}));
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest updated with ${taken.length} screenshots`);
