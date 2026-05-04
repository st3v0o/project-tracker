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

# Require Node.js 20+ (better-sqlite3 supports only Node 20, 22, 23, 24, 25)
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

# Install pnpm if missing
if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}pnpm not found — installing via npm...${NC}"
  npm install -g pnpm
fi

# Create .env from template on first run
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}Created .env from .env.example${NC}"
  echo "  → Add your OPENAI_API_KEY to .env to enable AI features"
  echo ""
fi

# Load .env into the current shell
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

# Cleanup handler
cleanup() {
  echo ""
  echo "  Stopping servers..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start API server (build first, then start)
echo "  Starting API server  →  http://localhost:${API_PORT}"
(
  cd artifacts/api-server
  NODE_ENV=development PORT="$API_PORT" pnpm run build \
    && NODE_ENV=development PORT="$API_PORT" pnpm run start
) >/tmp/api-server.log 2>&1 &
API_PID=$!

# Wait for the API health endpoint (max 30 s)
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
(
  cd artifacts/project-tracker
  NODE_ENV=development PORT="$WEB_PORT" BASE_PATH=/ API_PORT="$API_PORT" pnpm run dev
) >/tmp/web.log 2>&1 &
WEB_PID=$!

# Wait for Vite to be ready before opening browser (max 120 s)
echo "  Waiting for web app..."
for i in {1..40}; do
  if curl -sf "http://localhost:${WEB_PORT}" &>/dev/null; then
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo -e "${RED}Error: Web app did not start within 120 seconds.${NC}"
    echo "  Check the log: /tmp/web.log"
    exit 1
  fi
  sleep 3
done

# Open browser once Vite is ready
command -v open    &>/dev/null && open    "http://localhost:${WEB_PORT}" 2>/dev/null || true
command -v xdg-open &>/dev/null && xdg-open "http://localhost:${WEB_PORT}" 2>/dev/null || true

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

wait "$API_PID" "$WEB_PID"
