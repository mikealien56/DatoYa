#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${KHIPU_TEST_PORT:-3111}"
DB_DRIVER="${KHIPU_TEST_DB_DRIVER:-}"
LOG="/tmp/datoya-khipu-runtime.log"

node --check server.js
node --check khipu_payments_ui.js
grep -q "DATOYA KHIPU PAYMENTS V1" server.js
grep -q "app.post('/api/orders/:id/khipu/checkout'" server.js
grep -q "app.post('/api/khipu/webhook'" server.js
grep -q "payment_method='khipu'" server.js
grep -q "stalePaymentAssets" marketplace_commerce_assets.js

AUTH_TEST_MODE=true DEMO_MODE=false DB_DRIVER="$DB_DRIVER" PORT="$PORT" \
ADMIN_EMAIL="admin-khipu-ci@datoya.invalid" ADMIN_PASSWORD="DatoYa-Khipu-CI-2026" \
npm start >"$LOG" 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

READY=0
for i in $(seq 1 120); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    cat "$LOG"
    exit 1
  fi
  sleep 1
done
[ "$READY" -eq 1 ] || { cat "$LOG"; exit 1; }

curl -fsS "http://localhost:$PORT/khipu_payments_ui.js" | grep -q "dyPayOrderKhipu"
HTML=$(curl -fsS "http://localhost:$PORT/")
printf '%s' "$HTML" | grep -q "/khipu_payments_ui.js"
if printf '%s' "$HTML" | grep -Eqi 'mercadopago|marketplace_payments_ui'; then
  echo "El HTML final todavía publica un proveedor retirado"
  exit 1
fi

echo "✅ Runtime Khipu publicado sin scripts de Mercado Pago"
