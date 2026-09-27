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
CATEGORY1="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; c=json.load(sys.stdin)["categories"]; assert len(c)>=2; print(c[0]["id"])')"
CATEGORY2="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; c=json.load(sys.stdin)["categories"]; assert len(c)>=2; print(c[1]["id"])')"

register(){ local jar="$1" mail="$2" type="$3" name="$4"; curl -fsS -c "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" -d "{\"name\":\"$name\",\"email\":\"$mail\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null; local payload token; payload="$(curl -fsS -b "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}')"; token="$(printf '%s' "$payload"|python3 -c 'import sys,json;print(json.load(sys.stdin).get("test_token") or "")')"; curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" >/dev/null; }

register "$C" "$CLIENT_EMAIL" customer "Cliente Cupón"
register "$B" "$BUSINESS_EMAIL" business "Negocio Cupón"
BIZ="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"CuponQA$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY1,$CATEGORY2],\"address\":\"QA 123\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922223333\",\"whatsapp\":\"+56922223333\",\"pickup_enabled\":true,\"delivery_enabled\":false}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["business"]["id"])')"
: "${ADMIN_EMAIL:?}" "${ADMIN_PASSWORD:?}"
curl -fsS -c "$A" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
curl -fsS -b "$A" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$BIZ/status" -d '{"status":"active"}' >/dev/null

PROD1="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/products" -d "{\"name\":\"Producto Uno\",\"category_id\":$CATEGORY1,\"price\":20000,\"stock_tracking\":true,\"stock\":10,\"active\":true}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])')"
PROD2="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/products" -d "{\"name\":\"Producto Dos\",\"category_id\":$CATEGORY2,\"price\":10000,\"stock_tracking\":true,\"stock\":10,\"active\":true}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])')"

echo '1/8 Crear cupón limitado a un producto'
COUPON="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons" -d "{\"code\":\"PROD10\",\"name\":\"Solo producto uno\",\"discount_type\":\"percent\",\"discount_value\":10,\"max_discount\":3000,\"min_order\":10000,\"max_uses\":3,\"per_user_limit\":2,\"first_order_only\":false,\"scope_mode\":\"products\",\"product_ids\":[$PROD1]}")"
printf '%s' "$COUPON" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['coupon']['funding_source']=='business' and d['coupon']['scope_mode']=='products' and d['coupon']['product_ids']==[int('$PROD1')]"

echo '2/8 Plan Gratis bloquea segundo cupón activo'
CODE="$(curl -s -o "$TMP/second" -w '%{http_code}' -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons" -d '{"code":"OTRO10","discount_type":"percent","discount_value":10,"max_discount":1000,"min_order":5000,"max_uses":10,"per_user_limit":1}')"
[ "$CODE" = 409 ] || fail "segundo cupón activo aceptado HTTP $CODE"

echo '3/8 Validación descuenta solo el producto elegible'
QUOTE="$(curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/coupons/validate" -d "{\"business_id\":$BIZ,\"code\":\"PROD10\",\"subtotal\":30000,\"items\":[{\"product_id\":$PROD1,\"quantity\":1},{\"product_id\":$PROD2,\"quantity\":1}]}")"
printf '%s' "$QUOTE" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['discount_amount']==2000 and d['eligible_subtotal']==20000 and d['subtotal_after_discount']==28000 and d['coupon']['scope_mode']=='products' and d['datoya_funded_amount']==0"

echo '4/8 Pedido usa comisión sobre venta neta, no sobre precio previo al cupón'
ORDER="$(curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "{\"business_id\":$BIZ,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Cupón\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"coupon-product-$STAMP\",\"coupon_code\":\"PROD10\",\"items\":[{\"product_id\":$PROD1,\"quantity\":1},{\"product_id\":$PROD2,\"quantity\":1}]}")"
OID="$(printf '%s' "$ORDER"|python3 -c 'import sys,json;d=json.load(sys.stdin)["order"];assert d["subtotal"]==30000 and d["coupon_discount"]==2000 and d["total"]==28000 and d["commission_base"]==28000 and d["datoya_commission_estimate"]==2800 and d["coupon_datoya_funded"]==0;print(d["id"])')"

echo '5/8 Métricas muestran pedido, ventas netas y descuento'
curl -fsS -b "$B" "$BASE/api/businesses/$BIZ/coupons" | python3 -c 'import sys,json;d=json.load(sys.stdin);c=next(x for x in d["coupons"] if x["code"]=="PROD10");assert int(c["orders_generated"])==1 and int(c["sales_generated"])==28000 and int(c["discount_used"])==2000'

echo '6/8 Cancelar revierte uso y métricas; luego crear cupón de categoría'
curl -fsS -b "$C" -X POST "$BASE/api/orders/$OID/cancel" >/dev/null
CID="$(curl -fsS -b "$B" "$BASE/api/businesses/$BIZ/coupons" | python3 -c 'import sys,json;d=json.load(sys.stdin);c=next(x for x in d["coupons"] if x["code"]=="PROD10");assert int(c["used_count"])==0 and int(c["orders_generated"])==0 and int(c["sales_generated"])==0;print(c["id"])')"
curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons/$CID/toggle" -d '{"active":false}' >/dev/null
CAT_COUPON="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/coupons" -d "{\"code\":\"CAT1500\",\"name\":\"Categoría dos\",\"discount_type\":\"fixed\",\"discount_value\":1500,\"min_order\":5000,\"max_uses\":5,\"per_user_limit\":2,\"scope_mode\":\"categories\",\"category_ids\":[$CATEGORY2]}")"
printf '%s' "$CAT_COUPON" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['coupon']['scope_mode']=='categories' and d['coupon']['category_ids']==[int('$CATEGORY2')]"

echo '7/8 Cupón de categoría rechaza carrito sin productos elegibles y acepta el correcto'
MISS="$(curl -s -o "$TMP/miss" -w '%{http_code}' -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/coupons/validate" -d "{\"business_id\":$BIZ,\"code\":\"CAT1500\",\"subtotal\":20000,\"items\":[{\"product_id\":$PROD1,\"quantity\":1}]}")"
[ "$MISS" = 409 ] || fail "cupón de categoría aceptó producto fuera de alcance HTTP $MISS"
curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/coupons/validate" -d "{\"business_id\":$BIZ,\"code\":\"CAT1500\",\"subtotal\":30000,\"items\":[{\"product_id\":$PROD1,\"quantity\":1},{\"product_id\":$PROD2,\"quantity\":1}]}" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["eligible_subtotal"]==10000 and d["discount_amount"]==1500 and d["subtotal_after_discount"]==28500'

echo '8/8 Admin mantiene aporte DatoYa en cero'
curl -fsS -b "$A" "$BASE/api/admin/marketplace-v2/coupons" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert int(d["summary"]["datoya_funded"])==0 and d["datoya_funded_enabled"] is False'

echo '✅ COUPON V2 E2E OK: negocio financia + scopes + comisión neta + métricas + reversa'
