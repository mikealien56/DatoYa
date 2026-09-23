#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "MP TEST REDIRECT QA FAIL: $1"; exit 1; }

node --check marketplace_payments_bootstrap.js

grep -q "function __cmpCheckoutUrl" marketplace_payments_bootstrap.js || fail "Falta resolver seguro de checkout"
grep -q "mp&&mp.sandbox_init_point" marketplace_payments_bootstrap.js || fail "TEST no usa sandbox_init_point"
grep -q "mode==='test'&&!host.startsWith('sandbox.')" marketplace_payments_bootstrap.js || fail "TEST no exige host sandbox"
grep -q "modeInfo.mode==='test'?host.startsWith('sandbox.'):!host.startsWith('sandbox.')" marketplace_payments_bootstrap.js || fail "Validación TEST/live de host incorrecta"
if grep -q "const checkout=mp.init_point;" marketplace_payments_bootstrap.js; then fail "Checkout sigue usando init_point crudo"; fi
grep -q "location.href=r.checkout_url" marketplace_payments_ui.js || fail "Checkout TEST no abre directamente"
grep -q "marketplace_payments_ui.js?v=20260923-4" marketplace_commerce_assets.js || fail "Asset de pagos TEST no fue refrescado"

echo "Mercado Pago TEST redirect QA suite OK"
