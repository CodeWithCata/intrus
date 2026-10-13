/**
 * `pnpm dev:online`: everything needed to try online play on this computer, in one terminal.
 *   1. creates server/.dev.vars if it is missing (local secret + the localhost origins; git-ignored),
 *   2. starts the game server (`wrangler dev`, port 8787),
 *   3. starts the app (`vite dev`, port 5173) with VITE_PARTY_HOST pointing at that server.
 * Ctrl+C stops both. Local development only.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const varsFile = join(root, "server", ".dev.vars");

if (!existsSync(varsFile)) {
    writeFileSync(varsFile, "CODE_SECRET=local-dev-secret-change-me\nALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173\n");
    console.log("[dev:online] created server/.dev.vars (local only, git-ignored)");
}

const children = [];
let stopping = false;

function stopAll(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        try {
            if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
            else child.kill("SIGTERM");
        } catch {
            /* already gone */
        }
    }
    process.exit(code);
}

function run(label, command, env = {}) {
    const child = spawn(command, { cwd: root, shell: true, env: { ...process.env, ...env } });
    children.push(child);
    const pipe = (stream, out) =>
        stream.on("data", chunk => {
            for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) out.write(`[${label}] ${line}\n`);
        });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on("exit", code => {
        if (!stopping) {
            console.error(`[dev:online] ${label} stopped (exit code ${code}); stopping the other one too.`);
            stopAll(code ?? 1);
        }
    });
}

run("game-server", "pnpm party:dev --port 8787");
run("app", "pnpm dev --port 5173 --strictPort", { VITE_PARTY_HOST: "localhost:8787" });

console.log('\n[dev:online] When both are ready, open http://localhost:5173 and tap "Joacă online".');
console.log("[dev:online] Second player: use another browser (or a private window); tabs of one browser share the same saved data.");
console.log("[dev:online] Ctrl+C stops everything.\n");

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
