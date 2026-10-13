// @vitest-environment jsdom
/** Dragging a bottom sheet down to dismiss it (components/ui/sheet-drag.ts). */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

let dragToClose: typeof import("#lib/components/ui/sheet-drag.ts").dragToClose;
let sheetOut: typeof import("#lib/components/ui/sheet-motion.ts").sheetOut;

beforeAll(async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  ({ dragToClose } = await import("#lib/components/ui/sheet-drag.ts"));
  ({ sheetOut } = await import("#lib/components/ui/sheet-motion.ts"));
});

let scrim: HTMLElement, sheet: HTMLElement, grab: HTMLElement, body: HTMLElement, btn: HTMLElement;
let now = 0;
let close: Mock<() => void>;
let action: { destroy(): void };

const fire = (el: Element, type: string, props: Record<string, unknown>) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, props);
  el.dispatchEvent(e);
  return e;
};
const ptr = (el: Element, type: string, y: number, x = 0) => fire(el, type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, pointerType: "touch", button: 0 });
const touch = (el: Element, type: string, y: number, x = 0) => fire(el, type, { touches: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
const at = (t: number) => {
  now = t;
};

beforeEach(() => {
  document.body.innerHTML = `<div class="scrim"><div class="sheet"><div class="grab"></div><div class="shead"><h2 id="st">T</h2><button id="b">x</button></div><div id="body"><p>content</p></div></div></div>`;
  scrim = document.querySelector(".scrim")!;
  sheet = document.querySelector(".sheet")!;
  grab = document.querySelector(".grab")!;
  body = document.querySelector("#body")!;
  btn = document.querySelector("#b")!;
  Object.defineProperty(sheet, "offsetHeight", { value: 400, configurable: true });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  at(0);
  close = vi.fn();
  action = dragToClose(sheet, close);
});

afterEach(() => {
  action.destroy();
  vi.restoreAllMocks();
});

describe("drag by the grabber", () => {
  it("follows the pointer, fades the dim and closes past 30% of the height", () => {
    ptr(grab, "pointerdown", 100);
    at(100);
    ptr(grab, "pointermove", 120);
    at(200);
    ptr(grab, "pointermove", 160);
    expect(sheet.style.transform).toBe("translate3d(0,40px,0)");
    expect(sheet.hasAttribute("data-drag")).toBe(true);
    expect(Number(scrim.style.getPropertyValue("--dim"))).toBeLessThan(1);
    at(300);
    ptr(grab, "pointermove", 240);
    ptr(grab, "pointerup", 240);
    expect(close).toHaveBeenCalledTimes(1);
    expect(sheet.dataset.dy).toBe("120");
    expect(sheet.hasAttribute("data-drag")).toBe(false);
  });

  it("springs back and does not close when released early and slowly", () => {
    ptr(grab, "pointerdown", 100);
    at(300);
    ptr(grab, "pointermove", 160);
    at(600);
    ptr(grab, "pointermove", 180);
    ptr(grab, "pointerup", 180);
    expect(close).not.toHaveBeenCalled();
    expect(sheet.dataset.dy).toBe("0");
    expect(sheet.style.transform).toBe("translate3d(0,0,0)");
    expect(scrim.style.getPropertyValue("--dim")).toBe("");
  });

  it("closes on a quick downward flick", () => {
    ptr(grab, "pointerdown", 100);
    at(10);
    ptr(grab, "pointermove", 110);
    at(20);
    ptr(grab, "pointermove", 150);
    ptr(grab, "pointerup", 150);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("a plain tap (no movement) does nothing", () => {
    ptr(grab, "pointerdown", 100);
    ptr(grab, "pointerup", 100);
    expect(close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe("");
  });

  it("pulling up only moves it a little", () => {
    ptr(grab, "pointerdown", 300);
    at(100);
    ptr(grab, "pointermove", 250);
    ptr(grab, "pointermove", 0);
    expect(sheet.style.transform).toBe("translate3d(0,-24px,0)");
    ptr(grab, "pointerup", 0);
    expect(close).not.toHaveBeenCalled();
  });

  it("buttons in the header never start a drag", () => {
    ptr(btn, "pointerdown", 100);
    ptr(btn, "pointermove", 300);
    expect(sheet.style.transform).toBe("");
  });
});

describe("drag by the body on touch", () => {
  it("drags down from the top and closes when pulled far enough", () => {
    touch(body, "touchstart", 100);
    at(100);
    const e = touch(body, "touchmove", 130);
    expect(e.defaultPrevented).toBe(true);
    at(200);
    touch(body, "touchmove", 260);
    touch(body, "touchend", 260);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves the gesture to the page while the sheet is scrolled", () => {
    sheet.scrollTop = 40;
    touch(body, "touchstart", 100);
    const e = touch(body, "touchmove", 200);
    expect(e.defaultPrevented).toBe(false);
    expect(sheet.style.transform).toBe("");
  });

  it("ignores upward and sideways gestures", () => {
    touch(body, "touchstart", 100, 100);
    expect(touch(body, "touchmove", 80, 100).defaultPrevented).toBe(false);
    touch(body, "touchstart", 100, 100);
    expect(touch(body, "touchmove", 110, 160).defaultPrevented).toBe(false);
    expect(sheet.style.transform).toBe("");
  });
});

describe("exit transition after a drag", () => {
  it("continues from where the finger let go", () => {
    sheet.dataset.dy = "150";
    sheet.dataset.vy = "1";
    const t = sheetOut(sheet);
    expect(t.css!(0, 0)).toBe("transform:translate3d(0,150px,0)");
    expect(t.css!(0, 1)).toBe("transform:translate3d(0,400px,0)");
    expect(t.duration).toBe(250);
  });

  it("is the usual 60% sink when the sheet was not dragged", () => {
    expect(sheetOut(sheet).css!(0, 1)).toBe("transform:translateY(60%)");
  });
});
