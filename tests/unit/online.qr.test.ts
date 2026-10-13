import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "#lib/online/qr.ts";

describe("qr encoder", () => {
  it("picks the smallest version that fits and returns a square matrix", () => {
    expect(qrMatrix("A")).toHaveLength(21);
    expect(qrMatrix("https://intrus.netlify.app/online/ABCDEF")).toHaveLength(29);
    expect(qrMatrix("x".repeat(180))).toHaveLength(53);
  });
  it("is deterministic and different for different text", () => {
    expect(JSON.stringify(qrMatrix("hello"))).toBe(JSON.stringify(qrMatrix("hello")));
    expect(JSON.stringify(qrMatrix("hello"))).not.toBe(JSON.stringify(qrMatrix("hellp")));
  });
  it("has the three finder patterns and the dark module", () => {
    const m = qrMatrix("https://intrus.netlify.app/online/ABCDEF");
    const n = m.length;
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(m[y][x] && m[y][x + 6] && m[y + 6][x] && m[y + 6][x + 6]).toBe(true);
      expect(m[y + 3][x + 3]).toBe(true);
      expect(m[y + 1][x + 1]).toBe(false);
    }
    expect(m[n - 8][8]).toBe(true);
  });
  it("rejects text that is too long", () => {
    expect(() => qrMatrix("x".repeat(181))).toThrow(/too long/);
  });
  it("qrPath draws exactly the dark modules", () => {
    const m = qrMatrix("Hi");
    const { d, size } = qrPath("Hi");
    expect(size).toBe(m.length);
    const dark = m.flat().filter(Boolean).length;
    const drawn = [...d.matchAll(/h(\d+)v1/g)].reduce((n, x) => n + Number(x[1]), 0);
    expect(drawn).toBe(dark);
  });
});
