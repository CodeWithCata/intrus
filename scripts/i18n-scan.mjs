/**
 * Lists the hard-coded (not yet translated) texts of the app, file by file, so the move to src/lib/i18n/*.ts can be tracked.
 *   pnpm i18n:scan            summary per file
 *   pnpm i18n:scan --all      also prints every text found
 * Heuristic: in .svelte files, text between tags and the value of title / aria-label / placeholder / desc / label / name attributes;
 * in .ts files, string literals that have Romanian diacritics or look like a sentence. Word lists, i18n and tests are skipped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src/lib");
const SKIP = [/category-names\.ts$/, /category-icons\.ts$/, /[\\/]i18n[\\/]/, /[\\/]data[\\/]words[\\/]/, /\.test\.ts$/, /[\\/]debug[\\/]/];
const all = process.argv.includes("--all");

const walk = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export function findTexts(file, src) {
  const out = [];
  if (file.endsWith(".svelte")) {
    const markup = src.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    for (const m of markup.matchAll(/>([^<>{}]*[A-Za-zăâîșțĂÂÎȘȚ]{3,}[^<>{}]*)</g)) out.push(m[1].trim());
    for (const m of markup.matchAll(/\b(?:title|aria-label|placeholder|desc|label|name)="([^"{}]*[A-Za-zăâîșț]{3,}[^"{}]*)"/g)) out.push(m[1].trim());
  }
  else if (file.endsWith(".ts")) {
    for (const m of src.matchAll(/"([^"\n]{4,})"/g)) {
      const s = m[1];
      if (/[ăâîșțĂÂÎȘȚ]/.test(s) || (/ /.test(s) && /^[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(s) && !/[#.:/_=<>{}]/.test(s))) out.push(s);
    }
  }
  return out.filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let total = 0;
  const rows = [];
  for (const f of walk(SRC).filter(f => /\.(svelte|ts)$/.test(f) && !SKIP.some(r => r.test(f)))) {
    const found = findTexts(f, readFileSync(f, "utf8"));
    if (found.length) {
      rows.push([found.length, relative(ROOT, f), found]);
      total += found.length;
    }
  }
  rows.sort((a, b) => b[0] - a[0]);
  for (const [n, f, found] of rows) {
    console.log(`${String(n).padStart(4)}  ${f}`);
    if (all) found.forEach(s => console.log(`        ${s}`));
  }
  console.log(`\n${total} hard-coded texts in ${rows.length} files.`);
}
