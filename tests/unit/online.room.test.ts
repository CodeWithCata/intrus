import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, isLocal, clearSession, codeFromShare, codeFromText, ignoredFeatures, httpUrl, isValidCode, joinLink, loadName, loadSession, normalizeCode, saveName, saveSession, serverHost, settingsFromApp, customWordsFromApp, wsUrl, errorKey } from "#lib/online/room.ts";
import { MemKV } from "./online.helpers.ts";

describe("room codes and links", () => {
  it("normalizeCode keeps A-Z 0-9, upper-cased, max 6", () => {
    expect(normalizeCode("ab-c 12!x9z")).toBe("ABC12X");
  });
  it("isValidCode rejects the ambiguous characters 0 O 1 I and wrong lengths", () => {
    expect(isValidCode("ABCDEF")).toBe(true);
    for (const bad of ["ABCDE", "ABCDEFG", "ABCDE0", "ABCDEO", "ABCDE1", "ABCDEI", "abcdef", ""]) expect(isValidCode(bad)).toBe(false);
  });
  it("codeFromText reads links, ?room= and bare codes", () => {
    expect(codeFromText("https://intrus.app/online/k7m2qx")).toBe("K7M2QX");
    expect(codeFromText("/online/K7M2QX?x=1")).toBe("K7M2QX");
    expect(codeFromText("https://intrus.app/?room=K7M2QX&a=b")).toBe("K7M2QX");
    expect(codeFromText(" k7m2qx ")).toBe("K7M2QX");
    expect(codeFromText("https://intrus.app/online/K7M2Q")).toBeNull();
    expect(codeFromText("https://intrus.app/online/K7M2Q0")).toBeNull();
    expect(codeFromText("hello")).toBeNull();
  });
  it("codeFromShare reads a room link out of what another app shared, but never a bare word", () => {
    expect(codeFromShare("?url=https%3A%2F%2Fintrus.app%2Fonline%2Fk7m2qx")).toBe("K7M2QX");
    expect(codeFromShare("?title=Intrus&text=Hai%20la%20joc%3A%20https%3A%2F%2Fintrus.app%2Fonline%2FK7M2QX")).toBe("K7M2QX");
    expect(codeFromShare("?text=%2Fonline%2FK7M2QX")).toBe("K7M2QX");
    expect(codeFromShare("?text=BANANA")).toBeNull();
    expect(codeFromShare("?text=Hai%20la%20joc")).toBeNull();
    expect(codeFromShare("?url=https%3A%2F%2Fintrus.app%2Fonline%2FK7M2Q0")).toBeNull();
    expect(codeFromShare("")).toBeNull();
  });
  it("joinLink and the server urls", () => {
    expect(joinLink("https://intrus.app/", "ABCDEF")).toBe("https://intrus.app/online/ABCDEF");
    expect(wsUrl("party.example.workers.dev", "ABCDEF")).toBe("wss://party.example.workers.dev/parties/game/ABCDEF");
    expect(wsUrl("localhost:1999", "ABCDEF")).toBe("ws://localhost:1999/parties/game/ABCDEF");
    expect(httpUrl("localhost:8787", "/api/new-code")).toBe("http://localhost:8787/api/new-code");
    expect(httpUrl("party.example.dev", "/api/new-code")).toBe("https://party.example.dev/api/new-code");
  });
  it("serverHost cleans the env value and is null when unset", () => {
    expect(serverHost({ VITE_PARTY_HOST: " https://party.example.dev/ " })).toBe("party.example.dev");
    expect(serverHost({ VITE_PARTY_HOST: "" })).toBeNull();
    expect(serverHost({})).toBeNull();
    expect(serverHost(undefined)).toBeNull();
  });
});

describe("saved seat and name", () => {
  it("forgets a seat older than the time limit (the server room is long gone), and keeps a fresh one", () => {
    const kv = new MemKV();
    const seat = { code: "ABCDEF", playerId: "p", token: "t" };
    saveSession(seat, kv, 1_000);
    expect(loadSession(kv, 1_000 + SESSION_TTL_MS)).toEqual(seat);
    expect(loadSession(kv, 1_001 + SESSION_TTL_MS)).toBeNull();
    expect(kv.getItem("intrus.online.session")).toBeNull(); // and it is removed, not offered again
  });

  it("a seat saved before the timestamp existed still loads", () => {
    const kv = new MemKV();
    kv.setItem("intrus.online.session", JSON.stringify({ code: "ABCDEF", playerId: "p", token: "t" }));
    expect(loadSession(kv)).toEqual({ code: "ABCDEF", playerId: "p", token: "t" });
  });

  it("round-trips, and rejects damaged data", () => {
    const kv = new MemKV();
    expect(loadSession(kv)).toBeNull();
    saveSession({ code: "ABCDEF", playerId: "p", token: "t" }, kv);
    expect(loadSession(kv)).toEqual({ code: "ABCDEF", playerId: "p", token: "t" });
    kv.setItem("intrus.online.session", "{bad");
    expect(loadSession(kv)).toBeNull();
    kv.setItem("intrus.online.session", JSON.stringify({ code: "nope", playerId: "p", token: "t" }));
    expect(loadSession(kv)).toBeNull();
    saveSession({ code: "ABCDEF", playerId: "p", token: "t" }, kv);
    clearSession(kv);
    expect(loadSession(kv)).toBeNull();
  });
  it("never throws when storage is missing or broken", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(loadSession(broken)).toBeNull();
    expect(() => saveSession({ code: "ABCDEF", playerId: "p", token: "t" }, broken)).not.toThrow();
    expect(() => clearSession(broken)).not.toThrow();
    expect(loadSession(null)).toBeNull();
    expect(loadName(broken)).toBe("");
  });
  it("name is trimmed to 24 characters", () => {
    const kv = new MemKV();
    saveName("x".repeat(40), kv);
    expect(loadName(kv)).toHaveLength(24);
  });
});

const NO_MODES = { tw: false, qm: false, troll: false, twn: false, kn: false, wh: true }; // wh = opening wheel, on unless the player switched it off

describe("settings and errors", () => {
  it("maps the app's settings to the server's", () => {
    expect(settingsFromApp({ cats: ["Animale"], k: 2, tm: 3, hint: "cat" })).toEqual({ cats: ["Animale"], imposters: 2, minutes: 3, hint: "category", lang: "ro", ...NO_MODES, customName: "", customWords: [] });
    expect(settingsFromApp({ cats: [], k: 0, tm: 4, hint: "rel" }).minutes).toBe(3);
    expect(settingsFromApp({ cats: [], k: 1, tm: 1, hint: "cat" }).minutes).toBe(1); // the 1-minute preset is sent as 1, not rounded up to 2
    expect(settingsFromApp({ cats: [], k: 99, tm: 0, hint: "none" })).toEqual({ cats: [], imposters: 12, minutes: 0, hint: "none", lang: "ro", ...NO_MODES, customName: "", customWords: [] });
    expect(settingsFromApp({ cats: [], k: 1, tm: 5, hint: "ltr" }).hint).toBe("letter");
  });
  it("only real category names are sent; stale or custom ones are dropped", () => {
    const known = ["Animale", "Mâncare"];
    expect(settingsFromApp({ cats: ["Animale", "Personalizat", "Zzz", "Mâncare"], k: 1, tm: 3, hint: "cat" }, known).cats).toEqual(["Animale", "Mâncare"]);
    expect(settingsFromApp({ cats: ["Personalizat"], k: 1, tm: 3, hint: "cat" }, known).cats).toEqual([]); // empty = all on the server
  });
  it("the game modes are sent as switches (twin words and known partners never together)", () => {
    const on = settingsFromApp({ cats: [], k: 2, tm: 3, hint: "cat", tw: true, qm: true, troll: true, twn: false, kn: true });
    expect(on).toMatchObject({ tw: true, qm: true, troll: true, twn: false, kn: true });
    expect(settingsFromApp({ cats: [], k: 1, tm: 3, hint: "cat", twn: true, kn: true })).toMatchObject({ twn: true, kn: false });
  });
  it("the host's own words are sent only while the switch is on, in the format the app saves", () => {
    const custom = "pizza, grădină|Locuri|unde stai vara,  , lampă|Obiecte";
    expect(settingsFromApp({ cats: [], k: 1, tm: 3, hint: "cat", cu: false, custom }).customWords).toEqual([]);
    const s = settingsFromApp({ cats: [], k: 1, tm: 3, hint: "cat", cu: true, custom });
    expect(s.customWords).toEqual(["pizza", "grădină|Locuri|unde stai vara", "lampă|Obiecte"]);
    expect(s.customName).toBe("Personalizat");
    expect(customWordsFromApp({ cu: true, custom: Array.from({ length: 150 }, (_, i) => "w" + i).join(",") })).toHaveLength(100);
  });
  it("ignoredFeatures lists only what is still local-only: groups", () => {
    expect(ignoredFeatures({ gid: null })).toEqual([]);
    expect(ignoredFeatures({ tw: true, qm: true, troll: true, cu: true, gid: "g1" })).toEqual(["olFeatGroups"]);
  });
  it("errorKey maps server codes to message keys and falls back to the generic one", () => {
    expect(errorKey("full")).toBe("errFull");
    expect(errorKey("no-room")).toBe("errNoRoom");
    expect(errorKey("weird")).toBe("errGeneric");
  });

});

describe("isLocal (decides http/ws vs https/wss)", () => {
  it("accepts real local and private-network hosts, with or without a port", () => {
    for (const h of ["localhost", "localhost:8787", "127.0.0.1:8787", "[::1]:8787", "10.0.0.5", "192.168.1.20:8787", "172.16.0.1", "172.31.255.255"]) expect(isLocal(h)).toBe(true);
  });
  it("rejects public hosts that only START like a local one", () => {
    for (const h of ["localhost.evil.com", "10.example.com", "127.evil.com", "192.168.evil.com", "172.20.example.org", "10.0.0.5.evil.com", "[::1].evil.com"]) expect(isLocal(h)).toBe(false);
  });
  it("rejects public IPs, numbers out of range and the 172.x ranges outside 16-31", () => {
    for (const h of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "10.0.0.256", "intrus-party.me.workers.dev"]) expect(isLocal(h)).toBe(false);
  });
  it("httpUrl / wsUrl use the insecure scheme only for local hosts", () => {
    expect(wsUrl("localhost:8787", "ABCDEF")).toBe("ws://localhost:8787/parties/game/ABCDEF");
    expect(wsUrl("10.example.com", "ABCDEF")).toBe("wss://10.example.com/parties/game/ABCDEF");
    expect(httpUrl("10.example.com", "/api/new-code")).toBe("https://10.example.com/api/new-code");
  });
});
