/** The sticky "Gata" button must hide the content scrolling under it (flat bands in the sheet colour), also against performance.css, which forces a plain shadow on phones. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(new URL(`../../src/lib/styles/${f}`, import.meta.url), "utf8");

describe("sheet footer button", () => {
  const themes = read("themes.css");
  const rule = themes.split("\n").find(l => l.startsWith("html .sheet>.btn.go")) ?? "";

  it("paints solid bands above and below, as !important so the phone shadow reset cannot remove them", () => {
    expect(rule).toMatch(/0 -\d+px 0 \d+px var\(--shs\)/);
    expect(rule).toMatch(/0 \d+px 0 \d+px var\(--shs\)/);
    expect(rule).toMatch(/!important/);
  });

  it("also covers the pressed state", () => {
    expect(rule).toContain(".btn.go:active");
  });

  it("matches the sheet's bottom colour in every theme", () => {
    expect(themes).toMatch(/:root\{--shs:#F7F7FA\}/);
    expect(themes).toMatch(/html\[data-theme=dark\]\{--shs:#121217\}/);
    expect(themes).toMatch(/html\[data-theme=noir\]\{--shs:#0A0A0A\}/);
  });

  it("is more specific than the phone reset in performance.css", () => {
    expect(read("performance.css")).toMatch(/\.btn,\.btn\.go,\.btn\.go:active[^{]*\{box-shadow:[^}]*!important/);
  });
});
