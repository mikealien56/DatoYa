#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "MP TEST REDIRECT QA FAIL: $1"; exit 1; }

node --check marketplace_payments_bootstrap.js

grep -q "function __cmpCheckoutUrl" marketplace_payments_bootstrap.js || fail "Falta resolver seguro de checkout"
grep -q "mode==='test'&&host.startsWith('sandbox.')" marketplace_payments_bootstrap.js || fail "Falta normalización de host sandbox en TEST"
grep -q "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=" marketplace_payments_bootstrap.js || fail "Falta checkout web normal para TEST"
grep -q "modeInfo.mode!=='test'||!host.startsWith('sandbox.')" marketplace_payments_bootstrap.js || fail "TEST todavía permite devolver sandbox.mercadopago"
if grep -q "const checkout=mp.init_point;" marketplace_payments_bootstrap.js; then fail "Checkout sigue usando init_point crudo"; fi

echo "Mercado Pago TEST redirect QA suite OK"
