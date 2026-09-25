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
curl -fsS "$BASE/api/market/businesses?q=$BUSINESS_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$BIZ_ID') and x['status']=='active' for x in d.get('businesses',[]))"

echo "6/10 Negocio crea producto y aparece en búsqueda pública"
PRODUCT_JSON="$(curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/products" \
  -d "{\"name\":\"$PRODUCT_NAME\",\"description\":\"Producto de prueba beta\",\"category_id\":$CATEGORY_ID,\"price\":5990,\"stock_tracking\":true,\"stock\":5,\"active\":true}")"
PRODUCT_ID="$(printf '%s' "$PRODUCT_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print(d["product"]["id"])')"
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$PRODUCT_ID') for x in d.get('products',[]))"

echo "7/10 Cuenta Negocio no puede comprar"
CODE="$(curl -s -o "$TMP/business_order.json" -w '%{http_code}' -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" \
  -d "{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Negocio QA\",\"customer_phone\":\"+56922223333\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")"
[ "$CODE" = "403" ] || fail "Cuenta Negocio pudo comprar (HTTP $CODE)"
python3 -c 'import json; d=json.load(open("'"$TMP/business_order.json"'")); assert d.get("code")=="CUSTOMER_ACCOUNT_REQUIRED"'

echo "8/10 Cliente crea pedido real de prueba y baja stock una sola vez"
ORDER_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" \
  -d "{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente QA\",\"customer_phone\":\"+56911112222\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")"
ORDER_ID="$(printf '%s' "$ORDER_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True and d["order"]["status"]=="new"; print(d["order"]["id"])')"
curl -fsS -b "$CLIENT_JAR" "$BASE/api/orders/mine" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$ORDER_ID') for x in d.get('orders',[]))"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/businesses/$BIZ_ID/orders" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$ORDER_ID') for x in d.get('orders',[]))"
curl -fsS "$BASE/api/market/products?q=$PRODUCT_NAME" | python3 -c "import sys,json; d=json.load(sys.stdin); p=next(x for x in d['products'] if int(x['id'])==int('$PRODUCT_ID')); assert int(p['stock'])==4"

echo "9/10 Logout/login conserva tipo de cuenta y no cruza sesiones"
curl -fsS -b "$CLIENT_JAR" -c "$CLIENT_JAR" -X POST "$BASE/api/auth/logout" >/dev/null
curl -fsS -b "$BUSINESS_JAR" -c "$BUSINESS_JAR" -X POST "$BASE/api/auth/logout" >/dev/null
curl -fsS -b "$CLIENT_JAR" -c "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"$PASS\"}" >/dev/null
curl -fsS -b "$BUSINESS_JAR" -c "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$BUSINESS_EMAIL\",\"password\":\"$PASS\"}" >/dev/null
curl -fsS -b "$CLIENT_JAR" "$BASE/api/auth/me" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; assert u['email']=='$CLIENT_EMAIL' and u['account_type']=='customer'"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/auth/me" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; assert u['email']=='$BUSINESS_EMAIL' and u['account_type']=='business'"

echo "10/10 Separación final de permisos"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$CLIENT_JAR" "$BASE/api/businesses/mine")"
[ "$CODE" = "403" ] || fail "Cliente pudo abrir /businesses/mine (HTTP $CODE)"
curl -fsS -b "$BUSINESS_JAR" "$BASE/api/businesses/mine" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(int(x['id'])==int('$BIZ_ID') for x in d.get('businesses',[]))"

echo "✅ TWO ACCOUNT E2E OK: Cliente + Negocio + Admin + producto + búsqueda + pedido + sesiones"
