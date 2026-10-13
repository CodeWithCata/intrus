/** The question pool exists in both languages with the same number of questions. */
import { describe, expect, it } from "vitest";
import { QPOOL, QPOOL_EN, questionPool } from "#lib/data/questions.ts";

describe("question pool", () => {
  it("has the same questions in Romanian and English", () => {
    expect(QPOOL_EN.length).toBe(QPOOL.length);
    expect(new Set(QPOOL_EN).size).toBe(QPOOL_EN.length);
    expect(QPOOL_EN.every((q) => q.trim().length > 5)).toBe(true);
  });

  it("picks the pool by language", () => {
    expect(questionPool("en")).toBe(QPOOL_EN);
    expect(questionPool("ro")).toBe(QPOOL);
    expect(questionPool("xx")).toBe(QPOOL);
  });
});
