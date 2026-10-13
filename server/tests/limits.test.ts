import { describe, expect, test } from "vitest";
import { byteLength, exceedsLimit, MAX_CUSTOM_MSG_BYTES, MAX_MSG_BYTES } from "../limits.ts";

describe("message size limits are real bytes", () => {
  test("byteLength counts UTF-8 bytes, not characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("ă")).toBe(2);
    expect(byteLength("🦊")).toBe(4);
  });

  test("a normal message passes, a message over 8 KiB fails unless it is a settings message", () => {
    expect(exceedsLimit("x".repeat(100), "vote")).toBe(false);
    expect(exceedsLimit("x".repeat(MAX_MSG_BYTES + 1), "vote")).toBe(true);
    expect(exceedsLimit("x".repeat(MAX_MSG_BYTES + 1), "settings")).toBe(false);
    expect(exceedsLimit("x".repeat(MAX_CUSTOM_MSG_BYTES + 1), "settings")).toBe(true);
  });

  test("multi-byte text that is short in characters but over the limit in bytes is rejected", () => {
    const text = "ă".repeat(MAX_MSG_BYTES / 2 + 1); // 4097 characters = 8194 bytes
    expect(text.length).toBeLessThan(MAX_MSG_BYTES);
    expect(exceedsLimit(text, "vote")).toBe(true);
  });

  test("with no type known yet the larger limit applies", () => {
    expect(exceedsLimit("x".repeat(MAX_MSG_BYTES + 1))).toBe(false);
    expect(exceedsLimit("x".repeat(MAX_CUSTOM_MSG_BYTES + 1))).toBe(true);
  });
});
