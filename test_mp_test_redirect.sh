#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "MP TEST ORDERS QA FAIL: $1"; exit 1; }

node --check marketplace_payments_bootstrap.js

grep -q "mpHttp('POST','/v1/orders'" marketplace_payments_bootstrap.js || fail "TEST no crea Orders API"
grep -q "'X-Idempotency-Key':idem" marketplace_payments_bootstrap.js || fail "Falta idempotencia de Orders API"
grep -q "payer:{email:'test@testuser.com'}" marketplace_payments_bootstrap.js || fail "Falta payer TEST válido"
grep -q "processing_mode:'manual'" marketplace_payments_bootstrap.js || fail "Checkout Pro Orders requiere processing_mode manual"
grep -q "provider_api:'orders'" marketplace_payments_bootstrap.js || fail "Respuesta TEST no identifica Orders API"
grep -q "provider_order_id=excluded.provider_order_id" marketplace_payments_bootstrap.js || fail "No se persiste provider_order_id"
grep -q "p&&String(p.external_reference||'')==='datoya-order:'" marketplace_payments_bootstrap.js || fail "Falta validación de external_reference de Orders"
grep -q "topic==='order'" marketplace_payments_bootstrap.js || fail "Falta webhook topic order"
grep -q "DATOYA_ALLOW_LIVE_PAYMENTS" marketplace_payments_bootstrap.js || fail "Falta candado de pagos reales"

echo "Mercado Pago TEST Orders QA suite OK"
