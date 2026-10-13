// @vitest-environment jsdom
/**
 * Golden test for the intro screen: the DOM that IntroScreen.svelte renders is compared with tests/golden/intro.default.html.
 * Regenerate on purpose only (the design changed): UPDATE_GOLDEN=1 pnpm vitest run tests/unit/intro.golden.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { flushSync, mount } from "svelte";
import { beforeAll, describe, expect, it } from "vitest";
import { serialize } from "./helpers/dom.ts";
import { installShell } from "./helpers/screen.ts";

let m: any;
beforeAll(async () => {
  installShell();
  const [settings, nav, App] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/App.svelte")
  ]);
  m = { ...settings, ...nav };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

const dump = () =>
  `body.class=${JSON.stringify(document.body.className)} html.class=${JSON.stringify(document.documentElement.className)}\n` +
  `sheet-root=${JSON.stringify(document.getElementById("sr")!.innerHTML.replace(/<!--.*?-->/g, ""))}\n` +
  serialize(document.getElementById("app")!);

describe("intro screen golden DOM", () => {
  it("renders the intro slides", () => {
    m.state.sheet = null;
    m.go("intro");
    flushSync();
    const actual = dump();
    expect(actual).toContain('<article class="isl">'); // the screen really rendered
    const file = "tests/golden/intro.default.html";
    if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
      writeFileSync(file, actual);
      return;
    }
    expect(actual).toBe(readFileSync(file, "utf8"));
  });
});
