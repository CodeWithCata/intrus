import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import { defineConfig } from "eslint/config";

/*
 * Phase 1 setup: the code was ported from vanilla JS, so the inherited rules are reported as
 * warnings. Promote a rule to "error" once its warnings are gone (start with no-explicit-any).
 */
const asWarnings = configs =>
    configs.map(c => (c.rules ? { ...c, rules: Object.fromEntries(Object.entries(c.rules).map(([k, v]) => [k, Array.isArray(v) ? ["warn", ...v.slice(1)] : v === "off" || v === 0 ? v : "warn"])) } : c));

export default defineConfig(
    { ignores: [".svelte-kit/", "build/", "node_modules/", "static/", "test-results/", "playwright-report/"] },
    js.configs.recommended,
    ...asWarnings(ts.configs.recommended),
    ...asWarnings(svelte.configs["flat/recommended"]),
    prettier,
    ...svelte.configs["flat/prettier"],
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } }
    },
    {
        files: ["src/service-worker.ts"],
        languageOptions: { globals: { ...globals.serviceworker } }
    },
    {
        files: ["**/*.svelte", "**/*.svelte.ts"],
        languageOptions: { parserOptions: { parser: ts.parser } }
    },
    {
        // A component that imports a binding named like a rune ("state", "derived", ...) and also uses that rune ("$state(...)")
        // makes Svelte read "$state" as a store subscription on the import. It compiles, then crashes the whole screen at runtime.
        // Alias the import instead: `import { state as appState } from "#lib/stores/settings.svelte.ts"`.
        // Only components are affected (.svelte.ts modules compile fine), and only when the rune is really used in the same file.
        files: ["**/*.svelte"],
        rules: {
            "no-restricted-syntax": [
                "error",
                ...["state", "derived", "effect", "props", "bindable", "inspect", "host"].map(name => ({
                    selector: `Program:has(Identifier[name="$${name}"]) :matches(ImportSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier)[local.name="${name}"]`,
                    message: `"${name}" clashes with the $${name} rune used in this file: Svelte reads $${name}(...) as a store subscription and the screen crashes at runtime. Import it under another name, e.g. \`import { ${name} as app${name[0].toUpperCase()}${name.slice(1)} } from ...\`.`
                }))
            ]
        }
    },
    {
        rules: {
            // Legacy screens still render trusted, escaped strings with {@html}.
            "svelte/no-at-html-tags": "off",
            // Every unused argument is a cleanup candidate, not an error.
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn"
        }
    }
);
