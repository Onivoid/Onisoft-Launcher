/**
 * Cross-platform git hooks installer (Windows / macOS / Linux).
 * Used by `pnpm prepare` — no bash required.
 */
import { execSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

function isGitRepo() {
    try {
        execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

if (!isGitRepo()) {
    console.log("Skipping hooks setup (not a git repository)");
    process.exit(0);
}

execSync("git config core.hooksPath .githooks", { stdio: "inherit" });

if (process.platform !== "win32") {
    for (const hook of ["pre-commit", "post-commit"]) {
        const path = join(".githooks", hook);
        if (existsSync(path)) {
            chmodSync(path, 0o755);
        }
    }
}

console.log("✓ Git hooks installed (.githooks/)");
