#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Football Prediction Dashboard — one-command bootstrap
# ──────────────────────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Football Prediction Dashboard — Bootstrap      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install from https://nodejs.org/ (v18+)"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌  Node.js v18+ is required. Found: $(node --version)"
  exit 1
fi
echo "✅  Node.js $(node --version)"

# ── 2. Install backend dependencies ──────────────────────────────────────────
echo ""
echo "📦  Installing backend dependencies…"
cd "$ROOT/backend"
npm install

# ── 3. Install Playwright browsers (chromium only) ───────────────────────────
echo ""
echo "🎭  Installing Playwright Chromium…"
npx playwright install chromium --with-deps || {
  echo "⚠️   Playwright install failed. Manual fallback will still work."
}

# ── 4. Copy .env if not present ──────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "📄  Created backend/.env from .env.example"
fi

# ── 5. Install frontend dependencies ─────────────────────────────────────────
echo ""
echo "📦  Installing frontend dependencies…"
cd "$ROOT/frontend"
npm install

# ── 6. Launch both servers ────────────────────────────────────────────────────
echo ""
echo "🚀  Starting backend (port 3001) + frontend (port 5173)…"
echo "    Dashboard: http://localhost:5173"
echo ""
cd "$ROOT"

# Use concurrently if available; otherwise run in background
if npm list -g concurrently &>/dev/null 2>&1 || npm list concurrently &>/dev/null 2>&1; then
  npx concurrently \
    --names "BACKEND,FRONTEND" \
    --prefix-colors "blue,green" \
    "cd backend && npx ts-node-dev --respawn --transpile-only src/server.ts" \
    "cd frontend && npx vite"
else
  # Fallback: run backend in background, frontend in foreground
  (cd "$ROOT/backend" && npx ts-node-dev --respawn --transpile-only src/server.ts) &
  BACKEND_PID=$!
  echo "Backend PID: $BACKEND_PID"
  trap "kill $BACKEND_PID 2>/dev/null" EXIT
  cd "$ROOT/frontend" && npx vite
fi
