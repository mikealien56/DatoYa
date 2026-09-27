#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
PASS="DatoYa-Refund-QA-2026!"
STAMP="$(date +%s)-$$"
CLIENT_EMAIL="qa-refund-client-${STAMP}@datoya.test"
BUSINESS_EMAIL="qa-refund-business-${STAMP}@datoya.test"
BUSINESS_NAME="RefundQA${STAMP}"
TMP="$(mktemp -d)"
CLIENT_JAR="$TMP/client.cookies"
BUSINESS_JAR="$TMP/business.cookies"
ADMIN_JAR="$TMP/admin.cookies"
trap 'rm -rf "$TMP"' EXIT
fail(){ echo "REFUNDS E2E FAIL: $1"; exit 1; }

COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; x=json.load(sys.stdin)["comunas"]; assert x; print(x[0]["id"])')"
CATEGORY_ID="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; x=json.load(sys.stdin)["categories"]; assert x; print(x[0]["id"])')"

register(){
  local jar="$1" email="$2" type="$3" name="$4"
  curl -fsS -c "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register"     -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null
  local token
  token="$(curl -fsS -b "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get("test_token") or "")')"
  [ -n "$token" ] || fail "No hubo token TEST"
  curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" >/dev/null
}

register "$CLIENT_JAR" "$CLIENT_EMAIL" customer "Cliente Refund QA"
register "$BUSINESS_JAR" "$BUSINESS_EMAIL" business "Negocio Refund QA"

: "${ADMIN_EMAIL:?ADMIN_EMAIL requerido}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD requerido}"
curl -fsS -c "$ADMIN_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login"   -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

BIZ_JSON="$(curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses"   -d "{\"name\":\"$BUSINESS_NAME\",\"description\":\"Negocio para probar devoluciones\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"sector\":\"QA\",\"address\":\"QA 123\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922223333\",\"whatsapp\":\"+56922223333\",\"pickup_enabled\":true,\"delivery_enabled\":false}")"
BIZ_ID="$(printf '%s' "$BIZ_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["business"]["id"])')"
curl -fsS -b "$ADMIN_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$BIZ_ID/status" -d '{"status":"active"}' >/dev/null

PROD_JSON="$(curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/products"   -d "{\"name\":\"Producto devolución\",\"description\":\"QA\",\"category_id\":$CATEGORY_ID,\"price\":7990,\"stock_tracking\":true,\"stock\":8,\"active\":true}")"
PRODUCT_ID="$(printf '%s' "$PROD_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["product"]["id"])')"

create_paid_order(){
  local out id
  out="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders"     -d "{\"business_id\":$BIZ_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Refund QA\",\"customer_phone\":\"+56911112222\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")"
  id="$(printf '%s' "$out" | python3 -c 'import sys,json; print(json.load(sys.stdin)["order"]["id"])')"
  curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BIZ_ID/orders/$id/payment" -d '{"payment_status":"paid"}' >/dev/null
  echo "$id"
}

echo "1/2 Flujo negocio → devolución confirmada"
ORDER1="$(create_paid_order)"
R1_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/$ORDER1/refunds"   -d '{"reason":"quality","amount":7990,"details":"Producto con problema de calidad"}')"
R1="$(printf '%s' "$R1_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["refund"]["status"]=="requested"; print(d["refund"]["id"])')"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/refunds/$R1/decision"   -d '{"action":"approve","amount":7990,"note":"Aprobada por el negocio"}' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True and d.get("manual_confirmation_required") is True'
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/refunds/$R1/confirm-external"   -d '{"note":"Transferencia de devolución realizada"}' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["refund"]["status"]=="refunded" and d["refund"]["refunded_amount"]==7990'
curl -fsS -b "$CLIENT_JAR" "$BASE/api/orders/mine" | python3 -c "import sys,json; d=json.load(sys.stdin); o=next(x for x in d['orders'] if int(x['id'])==int('$ORDER1')); assert o['payment_status']=='refunded'"

echo "2/2 Rechazo → escalamiento → resolución Admin"
ORDER2="$(create_paid_order)"
R2_JSON="$(curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/$ORDER2/refunds"   -d '{"reason":"wrong_item","amount":7990,"details":"Recibí un producto distinto"}')"
R2="$(printf '%s' "$R2_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["refund"]["id"])')"
curl -fsS -b "$BUSINESS_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ_ID/refunds/$R2/decision"   -d '{"action":"reject","note":"El negocio no está de acuerdo"}' >/dev/null
curl -fsS -b "$CLIENT_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/refunds/$R2/escalate"   -d '{"note":"Solicito revisión de DatoYa"}' >/dev/null
curl -fsS -b "$ADMIN_JAR" "$BASE/api/admin/refunds" | python3 -c "import sys,json; d=json.load(sys.stdin); r=next(x for x in d['refunds'] if int(x['id'])==int('$R2')); assert r['status']=='escalated'"
curl -fsS -b "$ADMIN_JAR" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/refunds/$R2/resolve"   -d '{"action":"mark_refunded","amount":7990,"note":"Resolución de prueba Admin"}' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["refund"]["status"]=="refunded"'

echo "✅ REFUNDS E2E OK: cliente → negocio → escalamiento Admin → comisión revertida"
