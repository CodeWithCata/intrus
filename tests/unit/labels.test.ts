// @vitest-environment jsdom
/** Every Romanian label of a settings / rules table has an English entry, and `tr` only changes text in English. */
import { describe, expect, it, vi } from "vitest";
// The settings store reads matchMedia when it loads, so the stub must exist before the imports below run.
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
});

import { LABELS_EN } from "#lib/i18n/labels.ts";
import { locale, setLang, tr } from "#lib/i18n/index.svelte.ts";
import { ACCS, RV, THEMES } from "#lib/components/settings/settings.ts";
import { RB, RS } from "#lib/audio/reveal-sounds.ts";
import { TKS } from "#lib/audio/tick-styles.ts";
import { CARD_DESIGNS } from "#lib/data/card-designs.ts";
import { HD, HL } from "#lib/components/rules/rules-ui.ts";
import { displayName } from "#lib/utils/id.ts";
import { TWISTS } from "#lib/game/twists.ts";

const labels = (): string[] => [
  ...THEMES.map((x) => x[1]), ...ACCS.map((x) => x[1]), ...Object.values(RV).map((r) => r.l),
  ...RS.map((x) => x[1]), ...RB.map((x) => x[1]), ...Object.values(TKS).flat(), ...CARD_DESIGNS.map((x) => x[1]), ...HL, ...Object.values(HD), ...TWISTS.flatMap((x) => x.slice(1))
].filter((l) => l !== "forwards");

describe("table labels", () => {
  it("every label of every table has an English text", () => {
    expect(labels().filter((l) => !(l in LABELS_EN))).toEqual([]);
  });

  it("English texts are not empty", () => {
    expect(Object.entries(LABELS_EN).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it("tr leaves Romanian alone", () => {
    expect(locale.lang).toBe("ro");
    expect(tr("Luminos")).toBe("Luminos");
  });

  it("tr translates in English", () => {
    setLang("en", false);
    try {
      expect(tr("Luminos")).toBe("Light");
      expect(tr("text fără intrare")).toBe("text fără intrare");
    }
    finally {
      setLang("ro", false);
    }
  });
});

describe("default player name", () => {
  it("follows the language", () => {
    expect(displayName({ n: "" }, 1)).toBe("Jucător 2");
    expect(displayName({ n: " Ana " }, 1)).toBe("Ana");
    setLang("en", false);
    try {
      expect(displayName({ n: "" }, 1)).toBe("Player 2");
    }
    finally {
      setLang("ro", false);
    }
  });
});

describe("spoken time follows the language", () => {
  it("says the time in English", async () => {
    const { spokenTime } = await import("#lib/stores/talk.svelte.ts");
    expect(spokenTime(90)).toBe("1 minut și 30 de secunde");
    setLang("en", false);
    try {
      expect(spokenTime(90)).toBe("1 minute and 30 seconds");
      expect(spokenTime(150)).toBe("2 minutes and 30 seconds");
    }
    finally {
      setLang("ro", false);
    }
    expect(spokenTime(90)).toBe("1 minut și 30 de secunde");
  });
});
