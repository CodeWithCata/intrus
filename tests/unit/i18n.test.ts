import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, detectLang, interpolate, placeholders, readStoredLang, translate, writeStoredLang, LANG_KEY } from "#lib/i18n/core.ts";
import { en } from "#lib/i18n/en.ts";
import { ro } from "#lib/i18n/ro.ts";
import { errorKey } from "#lib/online/room.ts";
import { MemKV } from "./online.helpers.ts";

const keys = Object.keys(ro);

describe("dictionaries", () => {
  it("English has exactly the keys of Romanian, in both directions", () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
  });

  it("every key has the same {placeholders} in both languages", () => {
    const bad = keys.filter((k) => placeholders(ro[k as keyof typeof ro]).join() !== placeholders(en[k as keyof typeof en]).join());
    expect(bad).toEqual([]);
  });

  it("no string is empty or has stray whitespace, and braces are balanced", () => {
    for (const dict of [ro, en] as Record<string, string>[]) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v.length > 0 && v === v.trim()).toBe(true);
        expect((v.match(/\{/g) ?? []).length).toBe((v.match(/\}/g) ?? []).length);
        if (k.length === 0) throw new Error("empty key");
      }
    }
  });

  it("English is really translated: the online-play keys differ from Romanian", () => {
    const same = keys.filter((k) => k.startsWith("ol") || k.startsWith("err")).filter((k) => (ro as Record<string, string>)[k] === (en as Record<string, string>)[k]);
    expect(same.filter((k) => k !== "olYou")).toEqual([]);
  });

  it("English is really translated: the setup screen and category keys differ from Romanian", () => {
    const same = keys.filter((k) => /^(su|cat|cu|cs|st|ru|rd|hn|sq|tm|sp|is|cw|wl|hl)[A-Z]/.test(k)).filter((k) => (ro as Record<string, string>)[k] === (en as Record<string, string>)[k]);
    expect(same.filter((k) => !["suMin", "stTimer", "ruExtra", "isBub3"].includes(k))).toEqual([]);
  });
});

describe("every key used in the source exists", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(svelte|ts)$/.test(f)) files.push(p);
    }
  };
  walk(join(process.cwd(), "src"));

  it("t(\"key\") calls only use known keys", () => {
    const used = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"([A-Za-z0-9]+)"/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((k) => !keys.includes(k))).toEqual([]);
  });

  it("every error code the server can send maps to its own message, except the protocol-level ones", () => {
    const codes = new Set<string>();
    const serverFiles = [...readdirSync(join(process.cwd(), "server")).filter((f) => /^room-.*\.ts$/.test(f)), "session.ts"];
    for (const f of serverFiles) for (const m of readFileSync(join(process.cwd(), "server", f), "utf8").matchAll(/RoomError\(\s*"([a-z-]+)"/g)) codes.add(m[1]);
    const generic = [...codes].filter((c) => errorKey(c) === "errGeneric");
    expect(codes.size).toBeGreaterThan(10);
    // These are only seen by programmers (a message that is not valid JSON etc.), never in normal play.
    expect(generic.sort()).toEqual(["bad-kind", "bad-look", "bad-action", "bad-suspect", "no-timer", "no-vote", "not-in-round", "not-in-room", "vote-closed"].filter((c) => generic.includes(c)).sort());
  });
});

describe("helpers", () => {
  it("interpolate fills {names} and leaves a missing one visible", () => {
    expect(interpolate("Runda {n} din {total}", { n: 2, total: 5 })).toBe("Runda 2 din 5");
    expect(interpolate("Runda {n}", {})).toBe("Runda {n}");
    expect(interpolate("fără parametri")).toBe("fără parametri");
    expect(interpolate("{a}{a}", { a: "x" })).toBe("xx");
  });

  it("translate falls back to Romanian, then to the key", () => {
    expect(translate({ a: "A en" }, { a: "A ro", b: "B ro" }, "a")).toBe("A en");
    expect(translate({ a: "A en" }, { a: "A ro", b: "B ro" }, "b")).toBe("B ro");
    expect(translate({}, {}, "missing")).toBe("missing");
  });

  it("detectLang accepts only supported languages", () => {
    expect(detectLang("en")).toBe("en");
    expect(detectLang("ro")).toBe("ro");
    for (const bad of ["fr", "", null, undefined, "EN"]) expect(detectLang(bad as string)).toBe(DEFAULT_LANG);
  });

  it("the language is saved and read back; a broken storage never throws", () => {
    const kv = new MemKV();
    expect(readStoredLang(kv)).toBe("ro");
    writeStoredLang("en", kv);
    expect(kv.getItem(LANG_KEY)).toBe("en");
    expect(readStoredLang(kv)).toBe("en");
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(readStoredLang(broken)).toBe("ro");
    expect(() => writeStoredLang("en", broken)).not.toThrow();
    expect(readStoredLang(null)).toBe("ro");
  });
});
