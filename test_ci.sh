#!/bin/bash
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# CI starts from a clean workspace. Remove any prior SQLite files so tests are deterministic.
rm -f datoya.db datoya.db-shm datoya.db-wal
npm install --silent
npm start >/tmp/datoya-ci.log 2>&1 &
PID=$!
cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
  wait "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/categories >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "Servidor DatoYa no pudo iniciar"
    cat /tmp/datoya-ci.log
    exit 1
  fi
  sleep 1
done

if ! curl -fsS http://localhost:3000/api/categories >/dev/null 2>&1; then
  echo "Timeout esperando DatoYa"
  cat /tmp/datoya-ci.log
  exit 1
fi

bash test_e2e.sh
