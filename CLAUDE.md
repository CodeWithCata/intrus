# Claude Code notes

Read [AGENTS.md](./AGENTS.md) first (about 2k tokens): token-saving rules, the doc routing table, golden rules, screen flow and known failing tests. Then open only the `docs/ai/` file for your area, and use `docs/ai/FILE-MAP.md` to locate files.

One paragraph: screens are Svelte 5 components bound to reactive `$state` stores (`state`, `round`), navigation is only `go(screen, props)`, buttons use `onclick` with imported functions, bottom sheets are components wrapped in `ui/Sheet.svelte`, player text is never rendered as HTML, every new string is a `t()` key in both `ro.ts` and `en.ts`, and saved keys / avatar indexes 0-11 never change meaning.

Before finishing: `pnpm check` and `pnpm test`, and compare with "Known issues" in AGENTS.md.
