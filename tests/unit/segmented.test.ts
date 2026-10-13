// @vitest-environment jsdom
/** Segmented: the grid and the sliding pill must use as many columns as there are options (CSS default 4), or the bar is half empty. */
import { describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Segmented from "#lib/components/ui/Segmented.svelte";

const columns = (n: number) => {
  document.body.innerHTML = '<div id="t"></div>';
  const options = Array.from({ length: n }, (_, i) => [i, "o" + i] as const);
  const app = mount(Segmented, { target: document.getElementById("t")!, props: { options, value: 0 } });
  flushSync();
  const value = (document.querySelector(".seg") as HTMLElement).style.getPropertyValue("--n");
  unmount(app);
  return value;
};

describe("Segmented columns", () => {
  it("sets --n for 2, 3 and 5 options and leaves the CSS default for 4", () => {
    expect(columns(2)).toBe("2");
    expect(columns(3)).toBe("3");
    expect(columns(4)).toBe("");
    expect(columns(5)).toBe("5");
  });
});
