#!/usr/bin/env node
/**
 * build.mjs — Orchestrates the full Electron dist build.
 *
 * Usage (from workspace root):
 *   pnpm --filter @workspace/electron-app run dist
 *
 * What it does:
 *   1. Builds the React frontend  → artifacts/project-tracker/dist/public/
 *   2. Builds the API server      → artifacts/api-server/dist/
 *   3. Copies the API bundle      → artifacts/electron-app/api/
 *   4. Runs electron-builder      → artifacts/electron-app/dist/  (Setup.exe)
 *
 * Requires Windows build tools on Windows (MSVC / node-gyp) for
 * better-sqlite3 native rebuild, or runs via @electron/rebuild prebuilts.
 */

import { execSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

console.log("=== Project Tracker — Electron dist build ===\n");

// 1. Build React frontend
run("pnpm --filter @workspace/project-tracker run build", {
  cwd: workspaceRoot,
});

// 2. Build API server
run("pnpm --filter @workspace/api-server run build", {
  cwd: workspaceRoot,
});

// 3. Copy API bundle into electron-app/api/  (included in the asar)
const apiSrc = path.join(workspaceRoot, "artifacts", "api-server", "dist");
const apiDest = path.join(__dirname, "api");
console.log(`\n> Copying API bundle: ${apiSrc} → ${apiDest}`);
await rm(apiDest, { recursive: true, force: true });
await cp(apiSrc, apiDest, { recursive: true });

// 4. Run electron-builder (targets Windows NSIS by default)
// CSC_IDENTITY_AUTO_DISCOVERY=false disables code-signing on Linux/CI so the
// build completes without Wine. On Windows the env var is simply ignored and
// the system certificate store is used automatically.
run("pnpm exec electron-builder build --win", {
  cwd: __dirname,
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});

console.log("\n=== Build complete — installer is in artifacts/electron-app/dist/ ===");
