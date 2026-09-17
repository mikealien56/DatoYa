#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

MARKET_PORT=${MARKET_PORT:-3101}
MARKET_DB_DRIVER=${MARKET_DB_DRIVER:-}
if [ "$MARKET_DB_DRIVER" != "postgres" ]; then rm -f datoya.db datoya.db-shm datoya.db-wal; fi

ADMIN_EMAIL="admin-market-test@datoya.invalid"
ADMIN_PASSWORD="DatoYa-Test-Admin-2026"
PORT="$MARKET_PORT" DEMO_MODE=false DB_DRIVER="$MARKET_DB_DRIVER" AUTH_TEST_MODE=true \
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" npm start >/tmp/datoya-market-payment.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

B="http://localhost:$MARKET_PORT/api"
J='Content-Type: application/json'
for i in $(seq 1 120); do
  if curl -fsS "$B/market/categories" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then cat /tmp/datoya-market-payment.log; exit 1; fi
  sleep 1
  if [ "$i" = 120 ]; then cat /tmp/datoya-market-payment.log; exit 1; fi
done

json_value(){ python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }
verify_email(){
  local cookie="$1" response token
  response=$(curl -fsS -b "$cookie" -X POST "$B/auth/email-verification/request" -H "$J" -d '{}')
  token=$(printf '%s' "$response" | json_value 'd["test_token"]')
  curl -fsS -X POST "$B/auth/email-verification/confirm" -H "$J" -d "{\"token\":\"$token\"}" >/dev/null
}

TS=$(date +%s%N)
curl -fsS -c /tmp/dy_market_merchant -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"Comerciante TEST\",\"email\":\"merchant-$TS@datoya.invalid\",\"password\":\"DatoYa-Test-2026\",\"role\":\"cliente\",\"phone\":\"+56911112222\",\"comuna_id\":4}" >/dev/null
curl -fsS -c /tmp/dy_market_client -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"Cliente TEST\",\"email\":\"client-$TS@datoya.invalid\",\"password\":\"DatoYa-Test-2026\",\"role\":\"cliente\",\"phone\":\"+56933334444\",\"comuna_id\":4}" >/dev/null
verify_email /tmp/dy_market_merchant
verify_email /tmp/dy_market_client
curl -fsS -c /tmp/dy_market_admin -X POST "$B/auth/login" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

CATEGORY_ID=$(curl -fsS "$B/market/categories" | json_value 'd["categories"][0]["id"]')
BUSINESS=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/businesses" -H "$J" -d "{\"name\":\"Negocio Pago TEST $TS\",\"description\":\"Negocio temporal para validar pedidos y pagos\",\"business_type\":\"home_business\",\"comuna_id\":4,\"category_ids\":[$CATEGORY_ID],\"sector\":\"Sector TEST\",\"address\":\"Dirección privada TEST\",\"public_address_mode\":\"exact\",\"pickup_enabled\":true,\"delivery_enabled\":false}")
BUSINESS_ID=$(printf '%s' "$BUSINESS" | json_value 'd["business"]["id"]')
printf '%s' "$BUSINESS" | python3 -c 'import sys,json; b=json.load(sys.stdin)["business"]; assert b["business_type"]=="home_business"; assert b["public_address_mode"]=="approximate"; assert b["status"]=="pending_review"'
curl -fsS -b /tmp/dy_market_admin -X PUT "$B/admin/marketplace/businesses/$BUSINESS_ID/status" -H "$J" -d '{"status":"active"}' >/dev/null

PRODUCT=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/businesses/$BUSINESS_ID/products" -H "$J" -d "{\"name\":\"Producto Pago TEST\",\"description\":\"Producto temporal\",\"category_id\":$CATEGORY_ID,\"price\":1500,\"stock\":5,\"stock_tracking\":true,\"active\":true}")
PRODUCT_ID=$(printf '%s' "$PRODUCT" | json_value 'd["product"]["id"]')

ORDER=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":2}]}")
ORDER_ID=$(printf '%s' "$ORDER" | json_value 'd["order"]["id"]')
printf '%s' "$ORDER" | python3 -c 'import sys,json; o=json.load(sys.stdin)["order"]; assert o["subtotal"]==3000; assert o["total"]==3000; assert o["status"]=="new"; assert o["payment_status"]=="pending"'

PAYMENT=$(curl -fsS -b /tmp/dy_market_client "$B/orders/$ORDER_ID/mercadopago/status")
printf '%s' "$PAYMENT" | python3 -c 'import sys,json; d=json.load(sys.stdin); b=d["breakdown"]; assert d["available"] is False; assert b["amount"]==3000; assert b["datoya_fee"]==round(b["amount"]*d["commission_pct"]/100); assert b["seller_net_estimate"]==b["amount"]-b["datoya_fee"]'

CODE=$(curl -sS -o /tmp/dy_market_checkout.json -w '%{http_code}' -b /tmp/dy_market_client -X POST "$B/orders/$ORDER_ID/mercadopago/checkout" -H "$J" -d '{}')
[ "$CODE" = "409" ] || { echo "Checkout sin cuenta Mercado Pago debió responder 409 y respondió $CODE"; cat /tmp/dy_market_checkout.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_market_checkout.json")); assert "Mercado Pago" in d["error"]'

curl -fsS -b /tmp/dy_market_client -X POST "$B/orders/$ORDER_ID/cancel" -H "$J" -d '{}' >/dev/null
STOCK=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/manage" | json_value 'next(p["stock"] for p in d["products"] if p["id"]=='"$PRODUCT_ID"')')
[ "$STOCK" = "5" ] || { echo "El stock no se restituyó al cancelar: $STOCK"; exit 1; }

echo 'DatoYa marketplace payment TEST: OK (sin dinero real)'
