import { readFileSync } from "node:fs";

/** Import order of the stylesheets in src/routes/+layout.svelte (later wins). */
const ORDER = ["fonts", "tokens", "base", "features", "shell", "motion", "sheets", "themes", "card-designs", "performance"];

/** All app CSS in cascade order, so a test asserts a rule exists without caring which file holds it. */
export const allCss = (): string => ORDER.map((f) => readFileSync(`src/lib/styles/${f}.css`, "utf8")).join("\n");
