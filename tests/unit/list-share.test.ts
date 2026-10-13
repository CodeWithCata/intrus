/** Sharing custom word lists: round trips, caps and hostile payloads. */
import { describe, expect, it } from "vitest";
import { LIMITS, cleanText, decodeToken, encodeToken, fileName, makeLink, parseList, serializeList, tokenFromInput, uniqueName, validateList, wordsOfSaved } from "#lib/game/list-share.ts";

const ok = (r: any) => { if (!r.ok) throw new Error("expected ok, got " + r.reason); return r; };

describe("round trip", () => {
  it("link token: encode then decode gives the same list", async () => {
    const list = { name: "Gașca de la mare", words: ["pisică", "țuică", "ștrudel", "mămăligă", "soare"] };
    const tok = await encodeToken(list);
    expect(/^[01]\.[A-Za-z0-9_-]+$/.test(tok)).toBe(true);
    expect(ok(await decodeToken(tok)).list).toEqual(list);
  });
  it("file text: serialize then parse", () => {
    const list = { name: "Test", words: ["a", "b"] };
    expect(ok(parseList(serializeList(list))).list).toEqual(list);
  });
  it("finds the token in a pasted link, a hash, or alone", async () => {
    const tok = await encodeToken({ name: "x", words: ["y"] });
    for (const s of [makeLink("https://intrus.example/", tok), "#l=" + tok, "l=" + tok, " " + tok + " "]) expect(tokenFromInput(s)).toBe(tok);
    expect(tokenFromInput("hello world")).toBeNull();
    expect(tokenFromInput("")).toBeNull();
  });
});

describe("validation", () => {
  it("accepts the schema and ignores unknown keys", () => {
    const r = ok(validateList({ v: 1, name: "L", words: ["a", "b"], extra: { x: 1 }, isAdmin: true }));
    expect(r.list).toEqual({ name: "L", words: ["a", "b"] });
  });
  it("rejects a wrong version, a missing words array and non-objects", () => {
    expect((validateList({ v: 2, name: "x", words: ["a"] }) as any).reason).toBe("version");
    expect((validateList({ name: "x", words: ["a"] }) as any).reason).toBe("version");
    expect((validateList({ v: 1, name: "x" }) as any).reason).toBe("format");
    for (const bad of [null, 5, "x", [1, 2], undefined]) expect(validateList(bad).ok).toBe(false);
    expect((validateList({ v: 1, name: "x", words: [] }) as any).reason).toBe("no-words");
  });
  it("caps: name 40 characters, 300 words, 40 characters a word", () => {
    expect(ok(validateList({ v: 1, name: "n".repeat(100), words: ["a"] })).list.name).toHaveLength(LIMITS.name);
    expect((validateList({ v: 1, name: "x", words: Array.from({ length: 301 }, (_, i) => "w" + i) }) as any).reason).toBe("too-big");
    expect(ok(validateList({ v: 1, name: "x", words: Array.from({ length: 300 }, (_, i) => "w" + i) })).list.words).toHaveLength(300);
    const r = ok(validateList({ v: 1, name: "x", words: ["ok", "w".repeat(41), "w".repeat(40)] }));
    expect(r.list.words).toEqual(["ok", "w".repeat(40)]);
    expect(r.dropped).toBe(1);
  });
  it("rejects a payload over 8 KB before parsing it", () => {
    expect((parseList(JSON.stringify({ v: 1, name: "x", words: ["a".repeat(30)].concat(Array(400).fill("bcd")) })) as any).reason).toBe("too-big");
    expect((parseList("{".repeat(9000)) as any).reason).toBe("too-big");
  });
  it("strips control and bidi characters, collapses blanks, dedupes ignoring case", () => {
    const r = ok(validateList({ v: 1, name: "  Lista\u0000\u202E  mea ", words: ["Pisică", "pisică", "  ca\u200Bsă ", "\u0007", "a|b", "x,y"] }));
    expect(r.list.name).toBe("Lista mea");
    expect(r.list.words).toEqual(["Pisică", "casă", "a b", "x y"]);
  });
  it("keeps text as text: markup is never interpreted, only stored", () => {
    const r = ok(validateList({ v: 1, name: "<img src=x onerror=alert(1)>", words: ["<script>alert(1)</script>"] }));
    expect(r.list.words[0]).toBe("<script>alert(1)</script>"); // rendered by Svelte as text, never {@html}
  });
});

describe("hostile payloads", () => {
  it("__proto__ and constructor tricks change nothing", () => {
    const evil = parseList('{"v":1,"name":"x","words":["a"],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
    expect(evil.ok).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    const viaProto = parseList('{"__proto__":{"v":1,"words":["a"]}}');
    expect(viaProto.ok).toBe(false); // an inherited/proto key is not an own "v"
    expect(Object.keys((ok(evil) as any).list)).toEqual(["name", "words"]);
  });
  it("non-string words and nested arrays are dropped, not crashed on", () => {
    const r = ok(validateList({ v: 1, name: "x", words: [1, null, { a: 1 }, ["z"], "ok"] }));
    expect(r.list.words).toEqual(["ok"]);
  });
  it("garbage and malformed tokens fail cleanly", async () => {
    for (const t of ["", "not-a-token", "1.%%%", "1.AAAA", "0.AAAA", "9.AAAA", "1." + "A".repeat(LIMITS.token + 5), "0.e30"]) {
      const r = await decodeToken(t);
      expect(r.ok).toBe(false);
    }
  });
  it("a compression bomb is refused instead of expanded", async () => {
    if (typeof CompressionStream !== "function") return;
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter(); w.write(new TextEncoder().encode("a".repeat(5_000_000))); w.close();
    const chunks: Uint8Array[] = []; const rd = cs.readable.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); }
    let s = ""; for (const c of chunks) s += String.fromCharCode(...c);
    const tok = "1." + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const r: any = await decodeToken(tok);
    expect(r.ok).toBe(false);
  });
});

describe("names and files", () => {
  it("name collisions get a numbered name within the cap", () => {
    expect(uniqueName("Lista", ["altceva"])).toBe("Lista");
    expect(uniqueName("Lista", ["lista"])).toBe("Lista (2)");
    expect(uniqueName("Lista", ["Lista", "Lista (2)"])).toBe("Lista (3)");
    expect(Array.from(uniqueName("n".repeat(40), ["n".repeat(40)])).length <= LIMITS.name).toBe(true);
  });
  it("words of a saved list drop the category and hint", () => {
    expect(wordsOfSaved("pisică|Animale|miaună, câine,  , papagal")).toEqual(["pisică", "câine", "papagal"]);
  });
  it("file names are plain ASCII", () => {
    expect(fileName("Gașca de la mare!")).toBe("gasca-de-la-mare.intrus.json");
    expect(fileName("???")).toBe("lista.intrus.json");
    expect(cleanText(undefined, 5)).toBe("");
  });
});
