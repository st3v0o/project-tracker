#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  Project Tracker — local startup script
#  Works on macOS and Linux
# ─────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo ""
echo "  Project Tracker — starting locally"
echo "  ────────────────────────────────────"
echo ""

# Check Node.js (requires 20+; better-sqlite3 only supports Node 20+)
if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed.${NC}"
  echo "  Download it from https://nodejs.org (version 20 or later required)"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}Error: Node.js 20+ is required (you have $(node --version)).${NC}"
  echo "  Download the latest LTS from https://nodejs.org"
  exit 1
fi

# Check pnpm — install it if missing
if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}pnpm not found — installing via npm...${NC}"
  npm install -g pnpm
fi

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}Created .env from .env.example${NC}"
  echo "  → Edit .env and add your OPENAI_API_KEY to enable AI features"
  echo ""
fi

# Load .env into environment
set -o allexport
# shellcheck disable=SC1091
source .env 2>/dev/null || true
set +o allexport

# Install dependencies
echo "  Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo ""

# Ports
API_PORT="${API_PORT:-8080}"
WEB_PORT="${PORT:-3000}"

# Push the SQLite schema (creates/updates the local.db table structure)
if [ -z "${DATABASE_URL}" ]; then
  echo "  Syncing local SQLite schema..."
  SQLITE_PATH="${SQLITE_PATH:-local.db}" pnpm --filter @workspace/db db:push:local --accept-warnings 2>/dev/null || true
  echo ""
fi

# Cleanup on exit
cleanup() {
  echo ""
  echo "  Stopping servers..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start API server
echo "  Starting API server  →  http://localhost:${API_PORT}"
cd artifacts/api-server
NODE_ENV=development PORT="$API_PORT" pnpm run build && NODE_ENV=development PORT="$API_PORT" pnpm run start &>/tmp/api-server.log &
API_PID=$!
cd ../..

# Wait for API to be ready (max 30 attempts, 1 second apart)
echo "  Waiting for API server..."
for i in {1..30}; do
  if curl -sf "http://localhost:${API_PORT}/api/healthz" &>/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}Error: API server did not start within 30 seconds.${NC}"
    echo "  Check the log: /tmp/api-server.log"
    exit 1
  fi
  sleep 1
done

# Start web app
echo "  Starting web app      →  http://localhost:${WEB_PORT}"
cd artifacts/project-tracker
NODE_ENV=development PORT="$WEB_PORT" BASE_PATH=/ API_PORT="$API_PORT" pnpm run dev &>/tmp/web.log &
WEB_PID=$!
cd ../..

# Open browser after a short delay
sleep 2
if command -v open &>/dev/null; then
  open "http://localhost:${WEB_PORT}" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:${WEB_PORT}" 2>/dev/null || true
fi

echo ""
echo -e "  ${GREEN}Project Tracker is running!${NC}"
echo "  Web app:    http://localhost:${WEB_PORT}"
echo "  API server: http://localhost:${API_PORT}"
echo ""
echo "  API logs:  /tmp/api-server.log"
echo "  Web logs:  /tmp/web.log"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Wait for background processes
wait "$API_PID" "$WEB_PID"
