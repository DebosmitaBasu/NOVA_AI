#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

free_port() {
  local port=$1
  local pids

  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping process on port $port..."
    kill $pids 2>/dev/null || true
    sleep 0.4
  fi
}

free_port 5173
free_port 8000

echo ""
echo "============================================"
echo "  Open frontend: http://localhost:5173"
echo "  Backend API:   http://localhost:8000"
echo "============================================"
echo ""

exec npx concurrently -k -n backend,frontend -c blue,green \
  "npm --prefix ai_backend run dev" \
  "npm --prefix Debosmita-project run dev"
