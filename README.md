# Project Tracker

A full-stack ticket tracking app for managing work requests by US state, with AI-powered ticket creation from photos and voice.

## Features

- Create, edit, and track work requests (tickets) by US state, submitter, category, priority, and status
- Live "time since submission" counter on every ticket
- Filter and sort by any field, plus full-text search
- Export to Excel with one click
- AI photo parsing — take a screenshot or photo and let GPT extract ticket fields
- AI voice input — speak a ticket description and let Whisper + GPT fill the form
- CSV import to seed data from a backup file

---

## Running Locally

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | **20 or later** | https://nodejs.org |
| pnpm | any | installed automatically by the start script |

> **Why Node 20?** The local SQLite driver (`better-sqlite3`) requires Node.js 20+.

### Steps

**1. Clone or download the project**

```bash
git clone https://github.com/st3v0o/project-tracker.git
cd project-tracker
```

Or download the ZIP from GitHub and extract it.

**2. Start the app**

**Windows:**
```
start.bat
```

**macOS / Linux:**
```bash
chmod +x start.sh
./start.sh
```

The script will:
- Verify Node.js 20+ is installed
- Install pnpm if needed
- Install all dependencies
- Create a local SQLite database (`local.db`) automatically — no setup required
- Start the API server on port 8080
- Start the web app on port 3000
- Open your browser to http://localhost:3000

---

## Configuration

The start script creates a `.env` file from `.env.example` on first run. Edit it to customise ports or add your OpenAI API key.

### Enabling AI Features

AI photo parsing and voice-to-ticket require an OpenAI API key. Add yours to `.env`:

```
OPENAI_API_KEY=sk-...your-key-here...
```

Get a key at https://platform.openai.com/api-keys. Without a key the app works fully — only the AI buttons are non-functional.

### Custom Ports

```
API_PORT=8080   # API server (default 8080)
PORT=3000       # Web app   (default 3000)
```

### Using PostgreSQL Instead of SQLite

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string:

```
DATABASE_URL=postgresql://user:password@localhost:5432/tracker
```

The app switches to PostgreSQL automatically when `DATABASE_URL` is set.

---

## Importing Your Backup Data

If you have a CSV backup (from the Excel export or a prior backup), import it via a Node.js script:

```js
// import-tickets.mjs
import fs from 'fs';
const csv = fs.readFileSync('ticket-backup.csv', 'utf8');
const res = await fetch('http://localhost:8080/api/tickets/import-csv', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ csv }),
});
console.log(await res.json());
```

```bash
node import-tickets.mjs
```

The endpoint accepts CSV with these columns (header row required):

| Column | Required | Notes |
|--------|----------|-------|
| title | yes | |
| submitter | yes | |
| state | yes | Full US state name |
| category | yes | |
| description | no | |
| status | no | todo / pending / complete |
| priority | no | low / medium / high / critical |
| submitted_at | no | ISO 8601 date |
| completed_at | no | ISO 8601 date |
| pending_date | no | |

---

## Schema Changes (Local SQLite)

If a schema change is made to `lib/db/src/schema/tickets-sqlite.ts`, push it to your local database without data loss:

```bash
pnpm --filter @workspace/db db:push:local
```

This uses `drizzle-kit push` with the config at `lib/db/drizzle.config.local.ts`.

---

## Project Structure

```
artifacts/
  api-server/        Express API server (port 8080)
  project-tracker/   React + Vite web app (port 3000)
  tracker-mobile/    Expo iOS app (Expo Go only)
lib/
  db/                Drizzle ORM — auto-selects SQLite or PostgreSQL
  api-client-react/  Generated API hooks (TanStack Query)
  api-zod/           Request/response Zod schemas
start.sh             macOS/Linux startup script
start.bat            Windows startup script
.env.example         Environment variable template
```

## Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS, shadcn/ui, TanStack Query
- **Backend**: Express 5, Drizzle ORM
- **Database**: SQLite (local, via better-sqlite3) or PostgreSQL (Replit / production)
- **AI**: OpenAI GPT-4o-mini (text extraction) + Whisper (speech-to-text)
