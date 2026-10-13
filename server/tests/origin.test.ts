import { describe, expect, test } from "vitest";
import { isAllowedOrigin } from "../origin.ts";

const LIST = "https://intrus.example.com, http://localhost:5173/,https://*.netlify.app";

describe("isAllowedOrigin", () => {
  test("exact matches (case and trailing slash do not matter)", () => {
    expect(isAllowedOrigin("https://intrus.example.com", LIST)).toBe(true);
    expect(isAllowedOrigin("HTTP://LOCALHOST:5173", LIST)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", LIST)).toBe(false);
    expect(isAllowedOrigin("http://intrus.example.com", LIST)).toBe(false); // scheme matters
  });

  test("wildcard subdomains", () => {
    expect(isAllowedOrigin("https://deploy-preview-3--intrus.netlify.app", LIST)).toBe(true);
    expect(isAllowedOrigin("https://a.b.netlify.app", LIST)).toBe(true);
    expect(isAllowedOrigin("https://netlify.app", LIST)).toBe(false);
    expect(isAllowedOrigin("https://evilnetlify.app", LIST)).toBe(false);
    expect(isAllowedOrigin("https://x.netlify.app.evil.com", LIST)).toBe(false);
    expect(isAllowedOrigin("http://x.netlify.app", LIST)).toBe(false);
  });

  test("missing origin or empty list is refused; * allows everything", () => {
    expect(isAllowedOrigin(null, LIST)).toBe(false);
    expect(isAllowedOrigin("https://intrus.example.com", "")).toBe(false);
    expect(isAllowedOrigin("https://intrus.example.com", undefined)).toBe(false);
    expect(isAllowedOrigin(null, "*")).toBe(true);
    expect(isAllowedOrigin("https://anything.com", "*")).toBe(true);
  });
});

describe("isAllowedOrigin: one-label wildcard and unsafe wildcards", () => {
  const PREVIEWS = "https://intrus.example.com,https://*--intrus.netlify.app";

  test("*--site matches deploy previews of THAT site only, inside one label", () => {
    expect(isAllowedOrigin("https://deploy-preview-3--intrus.netlify.app", PREVIEWS)).toBe(true);
    expect(isAllowedOrigin("https://my-branch--intrus.netlify.app", PREVIEWS)).toBe(true);
    expect(isAllowedOrigin("https://deploy-preview-3--other.netlify.app", PREVIEWS)).toBe(false);
    expect(isAllowedOrigin("https://intrus.netlify.app", PREVIEWS)).toBe(false); // needs the "--" part
    expect(isAllowedOrigin("https://a.b--intrus.netlify.app", PREVIEWS)).toBe(false); // * never spans a dot
    expect(isAllowedOrigin("https://x--intrus.netlify.app.evil.com", PREVIEWS)).toBe(false);
    expect(isAllowedOrigin("http://x--intrus.netlify.app", PREVIEWS)).toBe(false);
  });

  test("a wildcard that is not followed by a full domain matches nothing", () => {
    for (const bad of ["https://*", "https://*.com", "https://*.", "http://localhost:*"]) {
      for (const o of ["https://evil.com", "https://a.com", "http://localhost:5173", "https://x"]) expect(isAllowedOrigin(o, bad)).toBe(false);
    }
  });

  test("regex characters in an entry are taken literally", () => {
    expect(isAllowedOrigin("https://intrusXexample.com", "https://intrus.example.com")).toBe(false);
    expect(isAllowedOrigin("https://aXexample.com", "https://*.example.com")).toBe(false);
  });
});
