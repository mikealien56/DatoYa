#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
STAMP="$(date +%s)-$$"
PASS="Coupon-${STAMP}-Aa1!"
CLIENT_EMAIL="coupon-client-${STAMP}@datoya.test"
BUSINESS_EMAIL="coupon-business-${STAMP}@datoya.test"
TMP="$(mktemp -d)"; C="$TMP/c"; B="$TMP/b"; A="$TMP/a"; trap 'rm -rf "$TMP"' EXIT
fail(){ echo "COUPON E2E FAIL: $1"; exit 1; }
COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; print(json.load(sys.stdin)["comunas"][0]["id"])')"
CATEGORY_ID="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; print(json.load(sys.stdin)["categories"][0]["id"])')"
register(){ local jar="$1" mail="$2" type="$3" name="$4"; curl -fsS -c "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" -d "{\"name\":\"$name\",\"email\":\"$mail\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null; local payload token; payload="$(curl -fsS -b "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}')"; token="$(printf '%s' "$payload"|python3 -c 'import sys,json;print(json.load(sys.stdin).get("test_token") or "")')"; curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" >/dev/null; }
register "$C" "$CLIENT_EMAIL" customer "Cliente Cupón"
register "$B" "$BUSINESS_EMAIL" business "Negocio Cupón"
BIZ="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"CuponQA$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"address\":\"QA 123\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922223333\",\"whatsapp\":\"+56922223333\",\"pickup_enabled\":true,\"delivery_enabled\":false}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["business"]["id"])')"
: "${ADMIN_EMAIL:?}" "${ADMIN_PASSWORD:?}"
curl -fsS -c "$A" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
curl -fsS -b "$A" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$BIZ/status" -d '{"status":"active"}' >/dev/null
PROD="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/products" -d "{\"name\":\"Producto Cupón\",\"category_id\":$CATEGORY_ID,\"price\":20000,\"stock_tracking\":true,\"stock\":5,\"active\":true}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])')"
echo '1/5 Crear cupón financiado por negocio'
COUPON="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons" -d '{"code":"PRIMERA10","name":"Primera compra","discount_type":"percent","discount_value":10,"max_discount":3000,"min_order":10000,"max_uses":2,"per_user_limit":1,"first_order_only":false}')"
printf '%s' "$COUPON" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["coupon"]["funding_source"]=="business" and d["max_campaign_cost"]==6000'
echo '2/5 Plan Gratis bloquea segundo cupón activo'
CODE="$(curl -s -o "$TMP/second" -w '%{http_code}' -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons" -d '{"code":"OTRO10","discount_type":"percent","discount_value":10,"max_discount":1000,"min_order":5000,"max_uses":10,"per_user_limit":1}')"
[ "$CODE" = 409 ] || fail "segundo cupón activo aceptado HTTP $CODE"
echo '3/5 Validación muestra descuento sin aporte DatoYa'
curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/coupons/validate" -d "{\"business_id\":$BIZ,\"code\":\"PRIMERA10\",\"subtotal\":20000}" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["discount_amount"]==2000 and d["business_funded_amount"]==2000 and d["datoya_funded_amount"]==0 and d["commission_protected"] is True'
echo '4/5 Pedido descuenta al cliente y protege comisión'
ORDER="$(curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "{\"business_id\":$BIZ,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Cupón\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"coupon-$STAMP\",\"coupon_code\":\"PRIMERA10\",\"items\":[{\"product_id\":$PROD,\"quantity\":1}]}" )"
OID="$(printf '%s' "$ORDER"|python3 -c 'import sys,json;d=json.load(sys.stdin)["order"];assert d["subtotal"]==20000 and d["coupon_discount"]==2000 and d["total"]==18000 and d["coupon_datoya_funded"]==0 and d["datoya_commission_estimate"]==2000;print(d["id"])')"
echo '5/5 Cancelar repone uso del cupón y DatoYa sigue en $0'
curl -fsS -b "$C" -X POST "$BASE/api/orders/$OID/cancel" >/dev/null
curl -fsS -b "$B" "$BASE/api/businesses/$BIZ/coupons" | python3 -c 'import sys,json;d=json.load(sys.stdin);c=next(x for x in d["coupons"] if x["code"]=="PRIMERA10");assert int(c["used_count"])==0'
curl -fsS -b "$A" "$BASE/api/admin/marketplace-v2/coupons" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert int(d["summary"]["datoya_funded"])==0 and d["datoya_funded_enabled"] is False'
echo '✅ COUPON E2E OK: negocio financia + límites + comisión protegida + reversa al cancelar'
