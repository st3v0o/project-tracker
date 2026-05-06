# Project Tracker

Full-stack ticket/work-request tracker by US state. Web app (React + Vite) + Express API + SQLite (local) or PostgreSQL (Replit). Includes a Windows Electron desktop installer with auto-update from GitHub Releases.

## Run & Operate

| Command | What it does |
|---|---|
| `start.bat` | Windows dev mode — installs, starts API + web, seeds DB, opens browser |
| `start.sh` | macOS/Linux dev mode |
| `pnpm --filter @workspace/electron-app run dist` | Build Windows installer (run on Windows; needs Node + pnpm) |
| `pnpm --filter @workspace/api-server run dev` | API server only |
| `pnpm --filter @workspace/project-tracker run dev` | Web frontend only |

Key env vars: `DATABASE_URL` (PostgreSQL; omit for SQLite), `API_PORT` (default 8080), `PORT` (web, default 3000), `OPENAI_API_KEY` (optional AI features), `SQLITE_PATH` (override SQLite file location), `STATIC_DIR` (set by Electron; Express serves React SPA from this dir), `ELECTRON_PACKAGED=1` (set by Electron; skips drizzle-kit CLI for schema bootstrap).

## Stack

- **Runtime**: Node 24, pnpm 10 (monorepo: `artifacts/*`, `lib/*`, `scripts`)
- **API**: Express 5, esbuild bundle, pino logger
- **DB**: Drizzle ORM — PostgreSQL (prod) / better-sqlite3 (local/Electron)
- **Frontend**: React 19, Vite 7, Tailwind 4, TanStack Query, wouter
- **Mobile**: Expo (React Native) — `artifacts/tracker-mobile`
- **Desktop**: Electron 33 + electron-builder (NSIS installer) + electron-updater (GitHub Releases)
- **Validation**: Zod, drizzle-zod, OpenAPI codegen (Orval)

## Where things live

- API routes: `artifacts/api-server/src/routes/`
- DB schema (PG): `lib/db/src/schema/tickets.ts`
- DB schema (SQLite): `lib/db/src/schema/tickets-sqlite.ts`
- DB connection (dual-mode): `lib/db/src/index.ts`
- React pages: `artifacts/project-tracker/src/`
- Electron main process: `artifacts/electron-app/main.mjs`
- Electron build config: `artifacts/electron-app/electron-builder.yml`
- Seed data: `seeds/tickets.json` (26 tickets), `seeds/seed-local.mjs`

## Architecture decisions

- **Dual DB mode**: `IS_SQLITE = !DATABASE_URL` in `lib/db/src/index.ts`; same Drizzle API for both dialects
- **Electron in-process API**: Express runs inside the Electron main process (dynamic `import()`) — no child processes, no CMD windows
- **Static serving**: `STATIC_DIR` env var tells Express to serve the built React SPA; SPA fallback (`*` → `index.html`) supports wouter client-side routing
- **Packaged schema bootstrap**: `ELECTRON_PACKAGED=1` makes `index.ts` use `CREATE TABLE IF NOT EXISTS` via better-sqlite3 directly, bypassing the drizzle-kit CLI which isn't available in the installed app
- **Auto-update**: `electron-updater` checks `github.com/st3v0o/project-tracker` Releases on every launch; tag a release as `v<version>` to deliver an update
- **Native rebuild**: electron-builder downloads prebuilt `better-sqlite3` binaries for Electron's Node ABI (no MSVC needed on the user's machine)

## Product

- Ticket board with state (US), category, status, priority, submitter
- Dashboard with charts by state and category
- CSV import/export (Excel-compatible)
- AI image/voice parsing for quick ticket creation
- Works offline with SQLite; syncs to PostgreSQL in the cloud

## User preferences

- Windows developer (`C:\Users\StevenMack\Dev\project-tracker`), Node v24, pnpm v10
- App pushed to `github.com/st3v0o/project-tracker` (origin/main)
- Prefers no CLI windows in the desktop app; auto-update from GitHub Releases

## Gotchas

- Building the Windows installer (`--win`) on Linux requires Wine (electron-builder limitation); run `dist` on Windows
- `better-sqlite3` must be rebuilt for Electron's ABI — electron-builder handles this automatically via `@electron/rebuild` prebuilts
- `electron` must be in `pnpm-workspace.yaml` `onlyBuiltDependencies` so pnpm downloads the Electron binary on install
- The `api/` and `dist/` directories inside `artifacts/electron-app/` are generated — gitignored, do not commit
- To publish an update: bump `version` in `artifacts/electron-app/package.json`, build installer on Windows, create a GitHub Release tagged `v<version>`, attach the `Setup.exe`
