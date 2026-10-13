/** The installable-app side of the project: manifest, home-screen shortcuts, share target and the iOS launch images. */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { shortcutFromSearch } from "#lib/utils/shortcut.ts";
import { allCss } from "./helpers/css.ts";

const manifest = JSON.parse(readFileSync("static/manifest.json", "utf8"));
const html = readFileSync("src/app.html", "utf8");
const inStatic = (src: string): boolean => existsSync("static" + src.split("?")[0]);

describe("web app manifest", () => {
  it("the title / status bar follows the page (no red bar); only the launch screen is red", () => {
    const meta = /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})">/.exec(html)![1];
    expect(manifest.theme_color).toBe(meta);
    expect(meta.toUpperCase()).toBe("#FFFFFF");
    expect(manifest.background_color.toUpperCase()).toBe("#D8002B");
  });

  it("desktop draws the page under the title bar (transparent bar), everything else is standalone (Android keeps its status bar and clock, no fullscreen)", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toEqual(["window-controls-overlay", "standalone"]);
  });

  it("has the drag strip and the Window Controls Overlay rules that make the title bar transparent", () => {
    const css = allCss();
    expect(html).toContain('<div id="tb" aria-hidden="true"></div>');
    expect(css).toContain("@media (display-mode: window-controls-overlay)");
    for (const piece of ["env(titlebar-area-height", "app-region:drag"]) expect(css, piece).toContain(piece);
    expect(css).toMatch(/#tb\{display:none\}/); // not rendered outside the overlay mode
  });

  it("every icon, shortcut icon and screenshot is a real file", () => {
    const files: string[] = [
      ...manifest.icons.map((i: { src: string }) => i.src),
      ...(manifest.shortcuts ?? []).flatMap((s: { icons?: { src: string }[] }) => (s.icons ?? []).map(i => i.src)),
      ...(manifest.screenshots ?? []).map((s: { src: string }) => s.src)
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(inStatic(f), f).toBe(true);
  });

  it("screenshots, when present, carry a size, a type and a form factor (Chrome refuses the rest)", () => {
    for (const s of manifest.screenshots ?? []) {
      expect(s.sizes).toMatch(/^\d+x\d+$/);
      expect(s.type).toBe("image/png");
      expect(["narrow", "wide"]).toContain(s.form_factor);
    }
  });

  it("has at most 4 shortcuts, all inside the scope, and the app understands each of them", () => {
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    expect(manifest.shortcuts.length).toBeLessThanOrEqual(4);
    for (const s of manifest.shortcuts) {
      expect(s.name).toBeTruthy();
      const url = new URL(s.url, "https://intrus.test");
      expect(url.pathname.startsWith(manifest.scope)).toBe(true);
      expect(shortcutFromSearch(url.search), s.url).not.toBeNull();
    }
  });

  it("the share target is a GET inside the scope", () => {
    const st = manifest.share_target;
    expect(st.method).toBe("GET");
    expect(st.action.startsWith(manifest.scope)).toBe(true);
    expect(st.params).toEqual({ title: "title", text: "text", url: "url" });
  });
});

describe("shortcut parameter", () => {
  it("accepts only the two known shortcuts", () => {
    expect(shortcutFromSearch("?shortcut=new")).toBe("new");
    expect(shortcutFromSearch("?a=1&shortcut=join")).toBe("join");
    expect(shortcutFromSearch("?shortcut=evil")).toBeNull();
    expect(shortcutFromSearch("?shortcut=")).toBeNull();
    expect(shortcutFromSearch("")).toBeNull();
  });
});

describe("iOS launch images", () => {
  const tags = [...html.matchAll(/<link rel="apple-touch-startup-image" href="%sveltekit\.assets%(\/splash\/(\d+)x(\d+)\.png)" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)">/g)];

  it("there is one for every common iPhone and iPad size", () => {
    expect(tags.length).toBeGreaterThanOrEqual(12);
  });

  it("each file exists and is exactly device size x pixel ratio", () => {
    for (const [, href, W, H, w, h, r] of tags) {
      expect(+W, href).toBe(+w * +r);
      expect(+H, href).toBe(+h * +r);
      expect(inStatic(href), href).toBe(true);
      const png = readFileSync("static" + href);
      expect(png.subarray(1, 4).toString(), href).toBe("PNG");
      expect(png.readUInt32BE(16), href).toBe(+W);
      expect(png.readUInt32BE(20), href).toBe(+H);
    }
  });

  it("the page asks to run as a web app, with a transparent iOS status bar (the page is drawn under the clock)", () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
  });
});
