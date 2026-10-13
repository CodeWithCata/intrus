import { describe, expect, it } from "vitest";
import { formatClock } from "#lib/utils/format.ts";
import { displayName } from "#lib/utils/id.ts";
import { STORAGE_KEY } from "#lib/storage/keys.ts";

describe("utils", () => {
  it("formatClock renders mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75)).toBe("01:15");
    expect(formatClock(600)).toBe("10:00");
  });

  it("displayName falls back to 'Jucător N'", () => {
    expect(displayName({ n: "  " }, 0)).toBe("Jucător 1");
    expect(displayName({ n: " Ana " }, 1)).toBe("Ana");
  });

  it("keeps the saved-game key stable", () => {
    expect(STORAGE_KEY).toBe("intrus.v6");
  });
});
