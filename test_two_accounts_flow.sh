#!/usr/bin/env bash
set -euo pipefail

BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
PASS="DatoYa-QA-2026!"
STAMP="$(date +%s)-$$"
CLIENT_EMAIL="qa-client-${STAMP}@datoya.test"
BUSINESS_EMAIL="qa-business-${STAMP}@datoya.test"
BUSINESS_NAME="NegocioQA${STAMP}"
PRODUCT_NAME="ProductoQA${STAMP}"

TMP="$(mktemp -d)"
CLIENT_JAR="$TMP/client.cookies"
BUSINESS_JAR="$TMP/business.cookies"
ADMIN_JAR="$TMP/admin.cookies"
trap 'rm -rf "$TMP"' EXIT

fail(){ echo "TWO ACCOUNT E2E FAIL: $1"; exit 1; }
json_assert(){ python3 -c "import sys,json; d=json.load(sys.stdin); assert ($1), $2"; }

COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; x=json.load(sys.stdin)["comunas"]; assert x; print(x[0]["id"])')"
CATEGORY_ID="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; x=json.load(sys.stdin)["categories"]; assert x; print(x[0]["id"])')"

register_account(){
  local jar="$1" email="$2" type="$3" name="$4"
  curl -fsS -c "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True'
  curl -fsS -b "$jar" "$BASE/api/auth/me" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; assert u['email']=='$email'; assert u.get('account_type')=='$type'"
  curl -fsS -b "$jar" "$BASE/api/auth/security-status" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("terms_current") is True and d.get("privacy_current") is True'
}

verify_account(){
  local jar="$1"
  local payload token
  payload="$(curl -fsS -b "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}')"
  token="$(printf '%s' "$payload" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("test_token") or "")')"
  [ -n "$token" ] || fail "AUTH_TEST_MODE no devolvió token de verificación"
  curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" \
    | python3 -c 'import sys,json; assert json.load(sys.stdin).get("ok") is True'
  curl -fsS -b "$jar" "$BASE/api/auth/security-status" | python3 -c 'import sys,json; assert json.load(sys.stdin).get("email_verified") is True'
}

echo "1/10 Registro Cliente y consentimiento vigente"
register_account "$CLIENT_JAR" "$CLIENT_EMAIL" "customer" "Cliente QA"
verify_account "$CLIENT_JAR"

echo "2/10 Cliente no puede registrar negocios"
CODE="$(curl -s -o "$TMP/client_business.json" -w '%{http_code}' -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" \
  -d "{\"name\":\"NoDebeCrear\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID]}")"
[ "$CODE" = "403" ] || fail "Cuenta Cliente pudo intentar registrar negocio (HTTP $CODE)"
python3 -c 'import json; d=json.load(open("'"$TMP/client_business.json"'")); assert d.get("code")=="BUSINESS_ACCOUNT_REQUIRED"'

echo "3/10 Registro Negocio, consentimiento y verificación"
register_account "$BUSINESS_JAR" "$BUSINESS_EMAIL" "business" "Encargado QA"
verify_account "$BUSINESS_JAR"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/businesses/mine" | python3 -c 'import sys,json; assert json.load(sys.stdin).get("businesses")==[]'

echo "4/10 Negocio nuevo queda pendiente de revisión"
BIZ_JSON="$(curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" \
  -d "{\"name\":\"$BUSINESS_NAME\",\"description\":\"Negocio de prueba E2E para beta\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"sector\":\"Sector QA\",\"address\":\"Dirección QA 123\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922223333\",\"whatsapp\":\"+56922223333\",\"pickup_enabled\":true,\"delivery_enabled\":false}")"
BIZ_ID="$(printf '%s' "$BIZ_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["business"]["status"]=="pending_review"; print(d["business"]["id"])')"
curl -fsS "$BASE/api/market/businesses?q=$BUSINESS_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert not any(int(x['id'])==int('$BIZ_ID') for x in d.get('businesses',[]))"

echo "5/10 Admin aprueba el negocio"
: "${ADMIN_EMAIL:?ADMIN_EMAIL requerido para E2E}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD requerido para E2E}"
curl -fsS -c "$ADMIN_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True'
curl -fsS -b "$ADMIN_JAR" "$BASE/api/auth/me" | python3 -c 'import sys,json; u=json.load(sys.stdin)["user"]; assert u.get("role")=="admin" and u.get("account_type")=="admin"'
curl -fsS -b "$ADMIN_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$BIZ_ID/status" -d '{"status":"active"}' \
  | python3 -c 'import sys,json; assert json.load(sys.stdin).get("ok") is True'
curl -fsS "$BASE/api/market/businesses?q=$BUSINESS_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$BIZ_ID') for x in d.get('businesses',[]))"

echo "6/10 Negocio crea producto y aparece en búsqueda pública"
PRODUCT_JSON="$(curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/products" \
  -d "{\"name\":\"$PRODUCT_NAME\",\"description\":\"Producto de prueba beta\",\"category_id\":$CATEGORY_ID,\"price\":5990,\"stock_tracking\":true,\"stock\":5,\"active\":true}")"
PRODUCT_ID="$(printf '%s' "$PRODUCT_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print(d["product"]["id"])')"
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$PRODUCT_ID') for x in d.get('products',[]))"

echo "7/10 Cuenta Negocio no puede comprar"
CODE="$(curl -s -o "$TMP/business_order.json" -w '%{http_code}' -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" \
  -d "{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Negocio QA\",\"customer_phone\":\"+56922223333\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")"
[ "$CODE" = "403" ] || fail "Cuenta Negocio pudo comprar (HTTP $CODE)"
echo "Respuesta bloqueo Negocio→compra: $(cat "$TMP/business_order.json")"
python3 -c 'import json; d=json.load(open("'"$TMP/business_order.json"'")); assert d.get("code")=="CUSTOMER_ACCOUNT_REQUIRED"'

echo "8/13 Pedido idempotente baja stock una sola vez"
REQ_ID="qa-order-$STAMP"
ORDER_BODY="{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"$REQ_ID\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}"
ORDER_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$ORDER_BODY")"
ORDER_ID="$(printf '%s' "$ORDER_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True and d["order"]["status"]=="new"; print(d["order"]["id"])')"
curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$ORDER_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('idempotent') is True and int(d['order']['id'])==int('$ORDER_ID')"
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); p=next(x for x in d['products'] if int(x['id'])==int('$PRODUCT_ID')); assert int(p['stock'])==4"

echo "9/13 Retiro usa código/QR privado y no se completa sin validarlo"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/businesses/$BIZ_ID/orders" | python3 -c "import sys,json; o=next(x for x in json.load(sys.stdin)['orders'] if int(x['id'])==int('$ORDER_ID')); assert 'pickup_code' not in o"
PICKUP_CODE="$(curl -fsS -b "$CLIENT_JAR" "$BASE/api/orders/mine" | python3 -c "import sys,json; o=next(x for x in json.load(sys.stdin)['orders'] if int(x['id'])==int('$ORDER_ID')); c=str(o.get('pickup_code') or ''); assert len(c)==6 and c.isdigit(); print(c)")"
for state in confirmed preparing ready; do
  curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$ORDER_ID/status" -d "{\"status\":\"$state\"}" >/dev/null
done
curl -fsS -b "$CLIENT_JAR" "$BASE/api/orders/$ORDER_ID/pickup-qr.svg" | grep -q '<svg' || fail "No se generó QR de retiro"
DIRECT_COMPLETE="$(curl -s -o /dev/null -w '%{http_code}' -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$ORDER_ID/status" -d '{\"status\":\"completed\"}')"
[ "$DIRECT_COMPLETE" = "400" ] || fail "Retiro se completó sin código (HTTP $DIRECT_COMPLETE)"
WRONG_CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/$ORDER_ID/pickup/verify" -d '{\"code\":\"000000\"}')"
[ "$WRONG_CODE" = "400" ] || fail "Código incorrecto no fue rechazado (HTTP $WRONG_CODE)"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/$ORDER_ID/pickup/verify" -d "{\"code\":\"$PICKUP_CODE\"}" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True and d.get("status")=="completed"'
curl -fsS -b "$CLIENT_JAR" "$BASE/api/orders/mine" | python3 -c "import sys,json; o=next(x for x in json.load(sys.stdin)['orders'] if int(x['id'])==int('$ORDER_ID')); assert o['status']=='completed' and o.get('pickup_verified_at')"

echo "10/13 Despacho valida mínimo y tarifa desde el servidor"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/delivery" -d '{\"enabled\":true,\"fee\":1500,\"min_order\":7000,\"free_from\":12000,\"radius_km\":5}' >/dev/null
DELIVERY_LOW="{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"delivery\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"delivery_address\":\"Dirección QA 456\",\"client_request_id\":\"qa-delivery-low-$STAMP\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}"
LOW_CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$DELIVERY_LOW")"
[ "$LOW_CODE" = "400" ] || fail "Backend aceptó despacho bajo mínimo (HTTP $LOW_CODE)"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/delivery" -d '{\"enabled\":true,\"fee\":1500,\"min_order\":5000,\"free_from\":12000,\"radius_km\":5}' >/dev/null
DELIVERY_REQ="qa-delivery-$STAMP"
DELIVERY_BODY="{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"delivery\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"delivery_address\":\"Dirección QA 456\",\"client_request_id\":\"$DELIVERY_REQ\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}"
DELIVERY_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$DELIVERY_BODY")"
DELIVERY_ID="$(printf '%s' "$DELIVERY_JSON" | python3 -c 'import sys,json; o=json.load(sys.stdin)["order"]; assert o["subtotal"]==5990 and o["delivery_fee"]==1500 and o["total"]==7490; print(o["id"])')"
curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$DELIVERY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('idempotent') is True and int(d['order']['id'])==int('$DELIVERY_ID')"
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); p=next(x for x in d['products'] if int(x['id'])==int('$PRODUCT_ID')); assert int(p['stock'])==3"

echo "11/13 Cancelaciones restauran stock una sola vez"
curl -fsS -b "$CLIENT_JAR" -X POST "$BASE/api/orders/$DELIVERY_ID/cancel" >/dev/null
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); p=next(x for x in d['products'] if int(x['id'])==int('$PRODUCT_ID')); assert int(p['stock'])==4"
SECOND_CANCEL="$(curl -s -o /dev/null -w '%{http_code}' -b "$CLIENT_JAR" -X POST "$BASE/api/orders/$DELIVERY_ID/cancel")"
[ "$SECOND_CANCEL" = "400" ] || fail "Segunda cancelación no fue rechazada (HTTP $SECOND_CANCEL)"
BIZ_CANCEL_BODY="{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"qa-business-cancel-$STAMP\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}"
BIZ_CANCEL_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$BIZ_CANCEL_BODY")"
BIZ_CANCEL_ID="$(printf '%s' "$BIZ_CANCEL_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["order"]["id"])')"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$BIZ_CANCEL_ID/status" -d '{\"status\":\"confirmed\"}' >/dev/null
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$BIZ_CANCEL_ID/status" -d '{\"status\":\"cancelled\"}' >/dev/null
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); p=next(x for x in d['products'] if int(x['id'])==int('$PRODUCT_ID')); assert int(p['stock'])==4"

echo "12/13 Pedido pagado no se cancela sin gestionar devolución"
PAID_BODY="{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"qa-paid-$STAMP\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}"
PAID_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "$PAID_BODY")"
PAID_ID="$(printf '%s' "$PAID_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["order"]["id"])')"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$PAID_ID/payment" -d '{\"payment_status\":\"paid\"}' >/dev/null
PAID_CLIENT="$(curl -s -o /dev/null -w '%{http_code}' -b "$CLIENT_JAR" -X POST "$BASE/api/orders/$PAID_ID/cancel")"
[ "$PAID_CLIENT" = "409" ] || fail "Cliente pudo cancelar pedido pagado (HTTP $PAID_CLIENT)"
PAID_BUSINESS="$(curl -s -o /dev/null -w '%{http_code}' -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$PAID_ID/status" -d '{\"status\":\"cancelled\"}')"
[ "$PAID_BUSINESS" = "409" ] || fail "Negocio pudo cancelar pedido pagado (HTTP $PAID_BUSINESS)"

echo "13/13 Logout/login conserva tipo de cuenta y separación final"
curl -fsS -b "$CLIENT_JAR" -c "$CLIENT_JAR" -X POST "$BASE/api/auth/logout" >/dev/null
curl -fsS -b "$BUSINESS_JAR" -c "$BUSINESS_JAR" -X POST "$BASE/api/auth/logout" >/dev/null
curl -fsS -b "$CLIENT_JAR" -c "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"$PASS\"}" >/dev/null
curl -fsS -b "$BUSINESS_JAR" -c "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$BUSINESS_EMAIL\",\"password\":\"$PASS\"}" >/dev/null
curl -fsS -b "$CLIENT_JAR" "$BASE/api/auth/me" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; assert u['email']=='$CLIENT_EMAIL' and u['account_type']=='customer'"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/auth/me" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; assert u['email']=='$BUSINESS_EMAIL' and u['account_type']=='business'"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$CLIENT_JAR" "$BASE/api/businesses/mine")"
[ "$CODE" = "403" ] || fail "Cliente pudo abrir /businesses/mine (HTTP $CODE)"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/businesses/mine" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$BIZ_ID') for x in d.get('businesses',[]))"

echo "✅ TWO ACCOUNT E2E OK: cuentas + pedido idempotente + despacho + stock + retiro QR + sesiones"
