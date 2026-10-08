#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT=3137
LOG="$(mktemp)"
AUTH_TEST_MODE=true DEMO_MODE=false PORT="$PORT" \
ADMIN_EMAIL="admin-payku-ci@datoya.invalid" ADMIN_PASSWORD="Payku-QA-Only-2026" \
PAYKU_MARKETPLACE_ENABLED=false \
node production_start.js >"$LOG" 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; rm -f "$LOG"; }
trap cleanup EXIT
READY=0
for i in $(seq 1 100); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then cat "$LOG"; exit 1; fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then cat "$LOG"; exit 1; fi
for path in \
  api/payku/marketplace/config \
  api/businesses/1/payku \
  api/businesses/1/payku/onboard \
  api/orders/1/payku/status \
  api/orders/1/payku/checkout \
  api/admin/payku/marketplace/status; do
  if [[ "$path" == */onboard || "$path" == */checkout ]]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$PORT/$path")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/$path")
  fi
  [ "$code" = 401 ] || { echo "Unexpected public access $path HTTP $code"; exit 1; }
done
curl -fsS "http://localhost:$PORT/payku_marketplace_ui.js" | grep -q 'dy-payku-card'
curl -fsS "http://localhost:$PORT/" | grep -q '/payku_marketplace_ui.js'
status=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/payku/marketplace/notify?order=INVALID")
[ "$status" = 200 ] || { echo "Untrusted callback error HTTP $status"; exit 1; }
echo "PAYKU RUNTIME OK: disabled by default; private routes protected; UI served"
