#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

export DEMO_MODE=false
export AUTH_TEST_MODE=true
export MARKET_DB_DRIVER=postgres
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/datoya_test}"
export MARKET_PORT="${MARKET_PORT:-3102}"

echo "=== DatoYa PostgreSQL E2E: marketplace comercial ==="
echo "Cuenta → negocio → aprobación → horarios → producto → privacidad → Fundador → QR → analítica → Impulso Ahora → pedido → stock → Mercado Pago TEST"

bash test_marketplace_payment.sh

echo "✅ DatoYa PostgreSQL marketplace E2E: OK"
