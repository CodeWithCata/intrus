// Generates docs/ai/FILE-MAP.md: one line per source file (size, purpose, exports) so an AI
// agent can find the right file without opening or grepping many. Run: pnpm map
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", ".svelte-kit", ".wrangler", "build", "assets", "golden"]);
// Folders summarised on one line instead of listing every file.
const COLLAPSE = [
  ["src/lib/data/words/", "word lists (data only); registry in src/lib/data/words/index.ts, counts in counts.ts"],
  ["src/routes/", "SvelteKit routes: every sub-route just redirects to / (single-screen state machine); only +layout.svelte (CSS import + boot()) matters"],
  ["server/tests/workers/", "Workers-pool tests (pnpm test:workers)"],
];
const EXT = /\.(ts|svelte|mjs|js|css)$/;

function walk(dir, out = []) {
  const entries = readdirSync(dir)
    .filter((n) => !SKIP_DIRS.has(n) && !n.startsWith("."))
    .map((n) => [n, statSync(join(dir, n)).isDirectory()])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])); // files first, then folders
  for (const [name, isDir] of entries) {
    if (isDir) walk(join(dir, name), out);
    else if (EXT.test(name)) out.push(join(dir, name));
  }
  return out;
}

function purpose(src) {
  let t = "";
  const block = src.match(/^\s*(?:<!--|\/\*+)([\s\S]*?)(?:-->|\*\/)/);
  if (block) t = block[1].split("\n").map((l) => l.replace(/^[\s*]+/, "").trim()).find(Boolean) ?? "";
  else {
    const line = src.match(/^\s*\/\/\s*(.+)/);
    if (line) t = line[1].trim();
  }
  return /^(eslint|@ts-|prettier|vitest|\/)/.test(t) ? "" : t.slice(0, 110);
}

function exportsOf(src) {
  const names = [];
  const re = /export\s+(?:async\s+)?(?:default\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of src.matchAll(re)) names.push(m[1]);
  const list = [...new Set(names)];
  if (!list.length) return "";
  const shown = list.slice(0, 6).join(", ");
  return list.length > 6 ? `${shown} +${list.length - 6}` : shown;
}

const lines = [];
const collapsed = new Set();
const testNames = {};
let dir = "";
for (const abs of walk(ROOT)) {
  const rel = relative(ROOT, abs).split(sep).join("/");
  if (rel.startsWith("scripts/words/") && !rel.endsWith("words.mjs")) continue;
  const c = COLLAPSE.find(([prefix]) => rel.startsWith(prefix));
  if (c) {
    if (!collapsed.has(c[0])) { collapsed.add(c[0]); lines.push(`- \`${c[0]}*\`: ${c[1]}`); }
    continue;
  }
  const d = rel.slice(0, rel.lastIndexOf("/") + 1);
  if (/^(server\/)?tests\/(unit\/|e2e\/)?$|^server\/tests\/$/.test(d) || d === "tests/unit/helpers/") {
    (testNames[d] ??= []).push(rel.slice(d.length).replace(/\.(test|spec)\.ts$/, ""));
    continue;
  }
  if (d !== dir) { dir = d; lines.push("", `### ${d || "./"}`); }
  const src = readFileSync(abs, "utf8");
  const kb = (statSync(abs).size / 1024).toFixed(1);
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  const why = purpose(src);
  const ex = rel.endsWith(".svelte") || rel.endsWith(".css") ? "" : exportsOf(src);
  lines.push(`- ${base} (${kb}K)${why ? ": " + why : ""}${ex ? ` [${ex}]` : ""}`);
}

lines.push("", "### Tests (name = file without .test.ts; golden snapshots in tests/golden/ are omitted)");
for (const [d, names] of Object.entries(testNames)) lines.push(`- \`${d}\`: ${names.join(", ")}`);

const header = `# File map (generated: do not edit; run \`pnpm map\`)

One line per source file: \`name (size): purpose [exports]\`. Folder headings are repo-root paths. A purpose appears only where the file starts with a comment; add a one-line top comment to a file to improve its entry. Word lists, assets, golden snapshots and lockfile are left out on purpose.
`;
writeFileSync(join(ROOT, "docs/ai/FILE-MAP.md"), header + lines.join("\n") + "\n");
console.log(`wrote docs/ai/FILE-MAP.md (${lines.length} lines)`);
