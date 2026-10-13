import { describe, expect, test } from "vitest";
import { PING as CLIENT_PING, PONG as CLIENT_PONG } from "../../src/lib/online/protocol.ts";
import { CLIENT_MESSAGE_TYPES, PING, PONG, parseClientMessage } from "../protocol.ts";
import { MAX_CUSTOM_MSG_BYTES, MAX_MSG_BYTES } from "../limits.ts";

const ok = (m: unknown) => parseClientMessage(JSON.stringify(m));
const code = (m: unknown) => {
  const r = ok(m);
  return r.ok ? "ok" : r.code;
};

describe("parseClientMessage", () => {
  test("accepts every valid message type", () => {
    const samples: unknown[] = [
      { type: "create", name: "Ana", l: 4097, ticket: "t", expires: 123 },
      { type: "join", name: "Bob" },
      { type: "join", name: "Bob", l: 0 },
      { type: "rejoin", playerId: "p1", token: "tok" },
      { type: "rejoin", playerId: "p1", token: "tok", l: 12 },
      { type: "look", l: 134217728 + 4097 },
      { type: "settings", settings: { cats: ["Animale"], imposters: 2, minutes: 3, hint: "related", lang: "ro", customName: "X", customWords: ["a", "b|Cat|un indiciu"], tw: true, qm: false, troll: true, twn: false, kn: true } },
      { type: "start" },
      { type: "start", imposters: 2, hint: "none" },
      { type: "seen" },
      { type: "talk-start" },
      { type: "reveal" },
      { type: "vote-open" },
      { type: "vote", suspectId: "p2" },
      { type: "vote-reveal" },
      { type: "question", action: "next" },
      { type: "question", action: "other", n: 3 },
      { type: "outcome", kind: "escaped", escapedIds: ["p1"] },
      { type: "outcome", kind: "troll" },
      { type: "timer", action: "add" },
      { type: "next-round" },
      { type: "leave" }
    ];
    expect(code({ type: "look", l: 7 })).toBe("bad-message"); // hat 7 does not exist
    expect(code({ type: "join", l: 1.5 })).toBe("bad-message");
    expect(code({ type: "join", l: "x" })).toBe("bad-message");
    expect(code({ type: "join", l: 268435456 })).toBe("bad-message");
    const covered = new Set(samples.map((x) => (x as { type: string }).type));
    for (const t of CLIENT_MESSAGE_TYPES) expect(covered.has(t)).toBe(true);
    for (const s of samples) expect(code(s)).toBe("ok");
  });

  test("not text, not JSON, not an object", () => {
    expect(parseClientMessage(42).ok).toBe(false);
    expect(parseClientMessage("{nope").ok).toBe(false);
    expect((parseClientMessage("{nope") as { code: string }).code).toBe("bad-json");
    expect(code([1, 2])).toBe("bad-json");
    expect(parseClientMessage("null").ok).toBe(false);
  });

  test("unknown or missing type", () => {
    expect(code({ type: "explode" })).toBe("unknown-type");
    expect(code({})).toBe("unknown-type");
    expect(code({ type: 5 })).toBe("unknown-type");
    expect(code({ type: "ping" })).toBe("unknown-type"); // the heartbeat is plain text, not JSON
  });

  test("wrong shapes are rejected", () => {
    expect(code({ type: "vote" })).toBe("bad-message");
    expect(code({ type: "vote", suspectId: 5 })).toBe("bad-message");
    expect(code({ type: "rejoin", playerId: "", token: "x" })).toBe("bad-message");
    expect(code({ type: "outcome", kind: "nonsense" })).toBe("bad-message");
    expect(code({ type: "timer", action: "explode" })).toBe("bad-message");
    expect(code({ type: "start", imposters: 99 })).toBe("bad-message");
    expect(code({ type: "start", imposters: 1.5 })).toBe("bad-message");
    expect(code({ type: "settings", settings: { minutes: 7 } })).toBe("bad-message");
    expect(code({ type: "settings", settings: { minutes: 4 } })).toBe("bad-message"); // only 0, 1, 2, 3 and 5 exist
    expect(code({ type: "settings", settings: { hint: "x" } })).toBe("bad-message");
    expect(code({ type: "settings" })).toBe("bad-message");
    expect(code({ type: "create", name: "a" })).toBe("bad-message"); // no ticket
    expect(code({ type: "join", name: "x".repeat(65) })).toBe("bad-message");
  });

  test("every timer preset of the app is accepted, including 1 minute", () => {
    for (const minutes of [0, 1, 2, 3, 5]) {
      const r = ok({ type: "settings", settings: { minutes } });
      expect(r.ok).toBe(true);
      if (r.ok && r.msg.type === "settings") expect(r.msg.settings).toEqual({ minutes });
    }
  });

  test("a client-chosen word is stripped, never passed on", () => {
    const r = ok({ type: "start", imposters: 1, word: "HACK", category: "HACK", decoy: "HACK" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.msg).includes("HACK")).toBe(false);
  });

  test("unknown settings fields are stripped; the game-mode switches are kept", () => {
    const r = ok({ type: "settings", settings: { minutes: 3, tw: true, qm: true, gid: "g", twists: ["x"], questions: true } });
    expect(r.ok).toBe(true);
    if (r.ok && r.msg.type === "settings") expect(r.msg.settings).toEqual({ minutes: 3, tw: true, qm: true });
  });

  test("size limits are in real bytes, and only settings may be large", () => {
    expect(code({ type: "vote", suspectId: "x", pad: "y".repeat(MAX_MSG_BYTES) })).toBe("too-large");
    const words = Array.from({ length: 100 }, (_, i) => "cuvânt" + i);
    expect(parseClientMessage(JSON.stringify({ type: "settings", settings: { customWords: words } })).ok).toBe(true);
    expect(code({ type: "settings", settings: {}, pad: "y".repeat(MAX_CUSTOM_MSG_BYTES) })).toBe("too-large");
    expect(parseClientMessage("ă".repeat(MAX_MSG_BYTES)).ok).toBe(false);
  });

  test("array lengths and string lengths are bounded", () => {
    expect(code({ type: "settings", settings: { customWords: Array(101).fill("a") } })).toBe("bad-message");
    expect(code({ type: "settings", settings: { customWords: ["x".repeat(101)] } })).toBe("bad-message");
    expect(code({ type: "outcome", kind: "escaped", escapedIds: Array(13).fill("a") })).toBe("bad-message");
    expect(code({ type: "question", action: "skip" })).toBe("bad-message");
    expect(code({ type: "settings", settings: { tw: "yes" } })).toBe("bad-message");
  });

  test("heartbeat constants agree between server and client", () => {
    expect(PING).toBe(CLIENT_PING);
    expect(PONG).toBe(CLIENT_PONG);
  });
});
