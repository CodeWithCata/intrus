/**
 * The service worker's own logic, run against a fake worker scope: install/activate, the navigation strategy
 * (network first, but the cached shell wins after NAV_TIMEOUT_MS or on any failure) and the SKIP_WAITING message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/manifest", () => ({ immutable: ["_app/immutable/a.js"], assets: ["icons/icon-192.png"] }));
vi.mock("$app/env", () => ({ version: "test-1" }));

type Handler = (e: any) => void;
const html = (body: string, init: ResponseInit = {}) => new Response(body, { headers: { "content-type": "text/html" }, ...init });

let handlers: Record<string, Handler>;
let store: Map<string, Map<string, Response>>;
let sw: any;

/** A minimal Cache Storage: enough for open / match / put / addAll / keys / delete. */
const makeCaches = () => ({
  open: async (name: string) => {
    const m = store.get(name) ?? store.set(name, new Map()).get(name)!;
    return {
      match: async (k: string) => m.get(k)?.clone(),
      put: async (k: string, r: Response) => void m.set(k, r),
      addAll: async (keys: string[]) => keys.forEach(k => m.set(k, new Response("x")))
    };
  },
  keys: async () => [...store.keys()],
  delete: async (n: string) => store.delete(n)
});

/** Fires a navigation fetch event and returns what the worker answered. `flush` also waits for the work kept alive with waitUntil. */
async function navigate(flush = true): Promise<Response> {
  let answer!: Promise<Response>;
  const waits: Promise<unknown>[] = [];
  handlers.fetch({
    request: { method: "GET", mode: "navigate", url: "https://game.test/online/ABC" },
    preloadResponse: Promise.resolve(undefined),
    respondWith: (p: Promise<Response>) => (answer = p),
    waitUntil: (p: Promise<unknown>) => waits.push(p)
  });
  const res = await answer;
  if (flush) {
    await Promise.allSettled(waits);
  }
  return res;
}

beforeEach(async () => {
  vi.resetModules();
  handlers = {};
  store = new Map();
  sw = {
    location: { hostname: "game.test", origin: "https://game.test" },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    registration: { navigationPreload: { enable: vi.fn(() => Promise.resolve()) }, unregister: vi.fn() }
  };
  vi.stubGlobal("self", sw);
  vi.stubGlobal("caches", makeCaches());
  await import("../../src/service-worker.ts");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const seedShell = async (body = "cached shell") => (await caches.open("intrus-test-1")).put("/index.html", html(body));

describe("install / activate / message", () => {
  it("installs only the core (code + shell) under a versioned cache, so the install is quick", async () => {
    const waits: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect([...store.get("intrus-test-1")!.keys()].sort()).toEqual(["/_app/immutable/a.js", "/index.html"]);
  });

  it("downloads the rest in the background when the page asks, skipping what is cached and surviving failures", async () => {
    const fetched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (p: string) => (fetched.push(p), new Response("img"))));
    const warm = async () => {
      const waits: Promise<unknown>[] = [];
      handlers.message({ data: { type: "WARM_CACHE" }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
      await Promise.all(waits);
    };
    await warm();
    expect(fetched).toEqual(["/icons/icon-192.png"]);
    expect([...store.get("intrus-test-1")!.keys()]).toEqual(["/icons/icon-192.png"]);
    await warm(); // already cached: nothing to fetch
    expect(fetched).toHaveLength(1);

    store.clear();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(warm()).resolves.toBeUndefined();
  });

  it("reports progress and the end to the open pages", async () => {
    const posted: any[] = [];
    sw.clients.matchAll = vi.fn(async () => [{ postMessage: (m: any) => posted.push(m) }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("img")));
    const waits: Promise<unknown>[] = [];
    handlers.message({ data: { type: "WARM_CACHE" }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(posted).toEqual([{ type: "WARM_PROGRESS", done: 1, total: 1 }, { type: "WARM_DONE" }]);
  });

  it("does not download media in the background on a Save-Data connection", async () => {
    sw.navigator = { connection: { saveData: true } };
    const fetchMock = vi.fn(async () => new Response("img"));
    vi.stubGlobal("fetch", fetchMock);
    const waits: Promise<unknown>[] = [];
    handlers.message({ data: { type: "WARM_CACHE" }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("activation removes only older intrus caches, enables navigation preload and claims clients", async () => {
    store.set("intrus-old", new Map());
    store.set("other-app", new Map());
    store.set("intrus-test-1", new Map());
    const waits: Promise<unknown>[] = [];
    handlers.activate({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect([...store.keys()].sort()).toEqual(["intrus-test-1", "other-app"]);
    expect(sw.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(sw.clients.claim).toHaveBeenCalled();
  });

  it("never skips waiting on its own, only when the page asks", () => {
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    handlers.message({ data: { type: "SOMETHING_ELSE" } });
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    handlers.message({ data: { type: "SKIP_WAITING" } });
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe("page navigation", () => {
  it("returns the fresh shell when the network answers, and stores it for next time", async () => {
    await seedShell("old shell");
    vi.stubGlobal("fetch", vi.fn(async () => html("new shell")));
    const res = await navigate();
    expect(await res.text()).toBe("new shell");
    expect(await (await (await caches.open("intrus-test-1")).match("/index.html"))!.text()).toBe("new shell");
  });

  it("opens the cached shell after the timeout when the network hangs", async () => {
    await seedShell("cached shell");
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const pending = navigate(false); // the fetch never settles, so there is nothing to flush
    await vi.advanceTimersByTimeAsync(2999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await (await pending).text()).toBe("cached shell");
  });

  it("opens the cached shell at once when the network fails (offline)", async () => {
    await seedShell("cached shell");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await (await navigate()).text()).toBe("cached shell");
  });

  it("keeps the cached shell when the server answers with an error, and does not overwrite it", async () => {
    await seedShell("cached shell");
    vi.stubGlobal("fetch", vi.fn(async () => html("Bad gateway", { status: 502 })));
    expect(await (await navigate()).text()).toBe("cached shell");
    expect(await (await (await caches.open("intrus-test-1")).match("/index.html"))!.text()).toBe("cached shell");
  });

  it("does not cache a non-HTML answer (captive portal, JSON) as the shell", async () => {
    await seedShell("cached shell");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })));
    await navigate();
    expect(await (await (await caches.open("intrus-test-1")).match("/index.html"))!.text()).toBe("cached shell");
  });

  it("on a first visit (nothing cached) waits for the network, and fails cleanly when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html("first load")));
    expect(await (await navigate()).text()).toBe("first load");
    store.clear();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect((await navigate()).type).toBe("error");
  });
});

describe("other requests", () => {
  it("serves precached files cache-first and leaves everything else (cross-origin, POST) to the network", async () => {
    await (await caches.open("intrus-test-1")).put("/icons/icon-192.png", new Response("icon"));
    const ask = (req: any) => {
      let answer: Promise<Response> | undefined;
      handlers.fetch({ request: req, respondWith: (p: Promise<Response>) => (answer = p), waitUntil() {} });
      return answer;
    };
    const hit = ask({ method: "GET", mode: "no-cors", url: "https://game.test/icons/icon-192.png" });
    expect(await (await hit!).text()).toBe("icon");
    expect(ask({ method: "POST", mode: "cors", url: "https://game.test/icons/icon-192.png" })).toBeUndefined();
    expect(ask({ method: "GET", mode: "cors", url: "https://other.test/icons/icon-192.png" })).toBeUndefined();
  });
});
