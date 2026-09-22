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
curl -fsS -c /tmp/dy_market_merchant -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"Comerciante TEST\",\"email\":\"merchant-$TS@datoya.invalid\",\"password\":\"DatoYa-Test-2026\",\"role\":\"cliente\",\"account_type\":\"business\",\"phone\":\"+56911112222\",\"comuna_id\":4}" >/dev/null
curl -fsS -c /tmp/dy_market_client -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"Cliente TEST\",\"email\":\"client-$TS@datoya.invalid\",\"password\":\"DatoYa-Test-2026\",\"role\":\"cliente\",\"account_type\":\"customer\",\"phone\":\"+56933334444\",\"comuna_id\":4}" >/dev/null
verify_email /tmp/dy_market_merchant
verify_email /tmp/dy_market_client
curl -fsS -c /tmp/dy_market_admin -X POST "$B/auth/login" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

INTEGRATIONS=$(curl -fsS -b /tmp/dy_market_admin "$B/admin/integration-status")
printf '%s' "$INTEGRATIONS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["email"]["provider"]=="resend"; assert "oauth" in d["mercadopago"]; assert "webhook" in d["mercadopago"]; assert d["mercadopago"]["live_payments_allowed"] is False'

CATEGORY_ID=$(curl -fsS "$B/market/categories" | json_value 'next(x["id"] for x in d["categories"] if x["name"]=="Pastelerías")')
COMUNA_ID=$(curl -fsS "$B/comunas" | json_value 'next(x["id"] for x in d["comunas"] if x["name"]=="Doñihue")')
BUSINESS=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/businesses" -H "$J" -d "{\"name\":\"Dulce Hogar TEST $TS\",\"description\":\"Emprendimiento temporal para validar privacidad, búsqueda, pedidos y pagos\",\"business_type\":\"home_business\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"latitude\":-34.233333,\"longitude\":-70.966667,\"location_accuracy\":12,\"location_source\":\"gps\",\"sector\":\"Sector TEST\",\"address\":\"Dirección residencial privada TEST 123\",\"public_address_mode\":\"exact\",\"pickup_enabled\":true,\"delivery_enabled\":false}")
BUSINESS_ID=$(printf '%s' "$BUSINESS" | json_value 'd["business"]["id"]')
BUSINESS_SLUG=$(printf '%s' "$BUSINESS" | json_value 'd["business"]["slug"]')
printf '%s' "$BUSINESS" | python3 -c 'import sys,json; b=json.load(sys.stdin)["business"]; assert b["business_type"]=="home_business"; assert b["public_address_mode"]=="approximate"; assert b["status"]=="pending_review"; assert b["location_source"]=="gps"; assert "province_id" in b'
curl -fsS -b /tmp/dy_market_admin -X PUT "$B/admin/marketplace/businesses/$BUSINESS_ID/status" -H "$J" -d '{"status":"active"}' >/dev/null

ALL_OPEN='{"mon":[{"open":"00:00","close":"23:59"}],"tue":[{"open":"00:00","close":"23:59"}],"wed":[{"open":"00:00","close":"23:59"}],"thu":[{"open":"00:00","close":"23:59"}],"fri":[{"open":"00:00","close":"23:59"}],"sat":[{"open":"00:00","close":"23:59"}],"sun":[{"open":"00:00","close":"23:59"}]}'
HOURS=$(curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/hours" -H "$J" -d "{\"schedule\":$ALL_OPEN,\"accept_orders_when_closed\":false}")
printf '%s' "$HOURS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"] is True; assert d["status"]["configured"] is True'

FOUNDER=$(curl -fsS -b /tmp/dy_market_admin -X PUT "$B/admin/marketplace/businesses/$BUSINESS_ID/founder" -H "$J" -d '{"enabled":true}')
printf '%s' "$FOUNDER" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["founder_business"] is True'


PRODUCT=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/businesses/$BUSINESS_ID/products" -H "$J" -d "{\"name\":\"Berlines caseros TEST\",\"description\":\"Producto temporal\",\"category_id\":$CATEGORY_ID,\"price\":1500,\"stock\":5,\"stock_tracking\":true,\"active\":true}")
PRODUCT_ID=$(printf '%s' "$PRODUCT" | json_value 'd["product"]["id"]')

# Lo Busco Ya: cliente publica -> negocio compatible la ve -> responde -> cliente recibe respuesta.
WANTED=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/wanted" -H "$J" -d '{"title":"Torta cumpleaños TEST '"$TS"'","category_id":'"$CATEGORY_ID"',"description":"Necesito una torta para 10 personas para mañana","budget":25000,"days":3,"radius_km":5,"comuna_id":'"$COMUNA_ID"'}')
WANTED_ID=$(printf '%s' "$WANTED" | json_value 'd["id"]')
printf '%s' "$WANTED" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["id"]>0; assert "notified_businesses" in d'
WANTED_BUSINESS=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/wanted")
printf '%s' "$WANTED_BUSINESS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(int(x["id"])==int("'"$WANTED_ID"'") for x in d["requests"]); assert d["stats"]["pending"]>=1; assert d["privacy"]'
WANTED_RESPONSE=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/wanted/$WANTED_ID/responses" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"message":"Sí, podemos prepararla para mañana.","product_id":'"$PRODUCT_ID"',"reference_price":24000,"availability":"Retiro mañana desde las 16:00"}')
printf '%s' "$WANTED_RESPONSE" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"] is True'
WANTED_MINE=$(curl -fsS -b /tmp/dy_market_client "$B/wanted/mine")
printf '%s' "$WANTED_MINE" | python3 -c 'import sys,json; d=json.load(sys.stdin); q=next(x for x in d["requests"] if int(x["id"])==int("'"$WANTED_ID"'")); assert len(q["responses"])==1; r=q["responses"][0]; assert r["business_name"].startswith("Dulce Hogar TEST"); assert r["product_name"]=="Berlines caseros TEST"; assert int(r["reference_price"])==24000; assert "16:00" in r["availability"]'
WANTED_NOTIF=$(curl -fsS -b /tmp/dy_market_client "$B/notifications/summary")
printf '%s' "$WANTED_NOTIF" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(n["type"]=="wanted_response" for n in d["notifications"])'
WANTED_AFTER=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/wanted")
printf '%s' "$WANTED_AFTER" | python3 -c 'import sys,json; d=json.load(sys.stdin); q=next(x for x in d["requests"] if int(x["id"])==int("'"$WANTED_ID"'")); assert q["response_id"]; assert int(q["response_price"])==24000; assert d["stats"]["responded"]>=1'

DELIVERY_CFG=$(curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/delivery" -H "$J" -d '{"enabled":true,"fee":1500,"min_order":2000,"free_from":5000,"radius_km":5}')
printf '%s' "$DELIVERY_CFG" | python3 -c 'import sys,json; d=json.load(sys.stdin)["delivery"]; assert d["enabled"] is True; assert d["fee"]==1500; assert d["min_order"]==2000; assert d["free_from"]==5000; assert d["radius_km"]==5'

DELIVERY_PUBLIC=$(curl -fsS "$B/market/business/$BUSINESS_SLUG/delivery")
printf '%s' "$DELIVERY_PUBLIC" | python3 -c 'import sys,json; d=json.load(sys.stdin)["delivery"]; assert d["enabled"] is True; assert d["fee"]==1500; assert d["radius_km"]==5'

DELIVERY_ORDER=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"fulfillment_method":"delivery","customer_name":"Cliente TEST","customer_phone":"+56933334444","delivery_address":"Dirección cliente TEST 456","delivery_latitude":-34.233333,"delivery_longitude":-70.966667,"items":[{"product_id":'"$PRODUCT_ID"',"quantity":2}]}')
DELIVERY_ORDER_ID=$(printf '%s' "$DELIVERY_ORDER" | json_value 'd["order"]["id"]')
printf '%s' "$DELIVERY_ORDER" | python3 -c 'import sys,json; o=json.load(sys.stdin)["order"]; assert o["subtotal"]==3000; assert o["delivery_fee"]==1500; assert o["total"]==4500; assert float(o["delivery_distance_km"])<0.1'
curl -fsS -b /tmp/dy_market_client -X POST "$B/orders/$DELIVERY_ORDER_ID/cancel" -H "$J" -d '{}' >/dev/null

OUTSIDE_CODE=$(curl -sS -o /tmp/dy_outside_delivery.json -w '%{http_code}' -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"fulfillment_method":"delivery","customer_name":"Cliente TEST","customer_phone":"+56933334444","delivery_address":"Fuera de radio TEST","delivery_latitude":-33.4489,"delivery_longitude":-70.6693,"items":[{"product_id":'"$PRODUCT_ID"',"quantity":2}]}')
[ "$OUTSIDE_CODE" = "400" ] || { echo "Despacho fuera de radio debió responder 400 y respondió $OUTSIDE_CODE"; cat /tmp/dy_outside_delivery.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_outside_delivery.json")); assert d.get("delivery_outside_radius") is True'

FREE_DELIVERY=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"fulfillment_method":"delivery","customer_name":"Cliente TEST","customer_phone":"+56933334444","delivery_address":"Dirección cliente TEST 456","delivery_latitude":-34.233333,"delivery_longitude":-70.966667,"items":[{"product_id":'"$PRODUCT_ID"',"quantity":4}]}')
FREE_DELIVERY_ID=$(printf '%s' "$FREE_DELIVERY" | json_value 'd["order"]["id"]')
printf '%s' "$FREE_DELIVERY" | python3 -c 'import sys,json; o=json.load(sys.stdin)["order"]; assert o["subtotal"]==6000; assert o["delivery_fee"]==0; assert o["total"]==6000'
curl -fsS -b /tmp/dy_market_client -X POST "$B/orders/$FREE_DELIVERY_ID/cancel" -H "$J" -d '{}' >/dev/null


PUBLIC_BUSINESS=$(curl -fsS "$B/market/businesses?lat=-34.233333&lng=-70.966667&radius=5")
printf '%s' "$PUBLIC_BUSINESS" | python3 -c 'import sys,json; d=json.load(sys.stdin); b=next(x for x in d["businesses"] if int(x["id"])=='"$BUSINESS_ID"'); assert b["comuna"]=="Doñihue"; assert b["region"]=="Libertador General Bernardo O'"'"'Higgins"; assert b["distance_km"]<0.1; assert "address" not in b; assert "latitude" not in b; assert "longitude" not in b; assert "location_accuracy" not in b'
PUBLIC_PRODUCT=$(curl -fsS "$B/market/products?q=berlines")
printf '%s' "$PUBLIC_PRODUCT" | python3 -c 'import sys,json; d=json.load(sys.stdin); p=next(x for x in d["products"] if int(x["id"])=='"$PRODUCT_ID"'); assert p["name"]=="Berlines caseros TEST"; assert p["price"]==1500'

PROFILE=$(curl -fsS "$B/market/business/$BUSINESS_SLUG")
printf '%s' "$PROFILE" | python3 -c 'import sys,json; b=json.load(sys.stdin)["business"]; assert b["founder_business"] is True; assert b["business_type"]=="home_business"; assert "address" not in b; assert "latitude" not in b; assert b["slug"]=="'"$BUSINESS_SLUG"'"'
curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/qr.svg" | grep -q '<svg'

VISITOR="e2e-$TS"
curl -fsS -X POST "$B/market/events" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"event_type\":\"profile_view\",\"visitor_id\":\"$VISITOR\"}" >/dev/null
curl -fsS -X POST "$B/market/events" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"event_type\":\"whatsapp_click\",\"visitor_id\":\"$VISITOR-wa\"}" >/dev/null
ANALYTICS=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/analytics?days=30")
printf '%s' "$ANALYTICS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["events"]["profile_view"]>=1; assert d["events"]["whatsapp_click"]>=1'

ADV_FREE_CODE=$(curl -sS -o /tmp/dy_adv_free.json -w '%{http_code}' -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/analytics?days=30&advanced=1")
[ "$ADV_FREE_CODE" = "403" ] || { echo "Analítica avanzada Gratis debió responder 403 y respondió $ADV_FREE_CODE"; cat /tmp/dy_adv_free.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_adv_free.json")); assert d.get("code")=="IMPULSO_PLAN_REQUIRED"'

FREE_IMPULSE_CODE=$(curl -sS -o /tmp/dy_impulse_free.json -w '%{http_code}' -b /tmp/dy_market_merchant -X POST "$B/businesses/$BUSINESS_ID/impulses" -H "$J" -d '{}')
[ "$FREE_IMPULSE_CODE" = "403" ] || { echo "Impulso Ahora Gratis debió responder 403 y respondió $FREE_IMPULSE_CODE"; cat /tmp/dy_impulse_free.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_impulse_free.json")); assert d.get("code")=="IMPULSO_PLAN_REQUIRED"'

GIFT=$(curl -fsS -b /tmp/dy_market_admin -X POST "$B/admin/marketplace-v2/impulso/gift" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"days":7}')
printf '%s' "$GIFT" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"] is True; assert d["membership"]["status"]=="active"'
ACCESS=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/plan-access")
printf '%s' "$ACCESS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["plan"]=="impulso"; assert d["access"]["impulse_now"] is True; assert d["access"]["advanced_analytics"] is True; assert d["limits"]["free_products"]==20; assert d["limits"]["impulso_products"]==200'
curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/analytics?days=30&advanced=1" >/dev/null

# La búsqueda pública debe alimentar Pulso Local y Radar sin exigir inicio de sesión.
for N in 1 2 3; do
  SEARCH_EVENT=$(curl -fsS -X POST "$B/market/search-events" -H "$J" -d '{"term":"berlines","category_id":'"$CATEGORY_ID"',"comuna_id":'"$COMUNA_ID"',"radius_km":5,"result_count":1,"visitor_id":"e2e-search-'"$TS"'-'"$N"'"}')
  printf '%s' "$SEARCH_EVENT" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"] is True'
done
PULSE=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/local-pulse?days=7")
printf '%s' "$PULSE" | python3 -c 'import sys,json; d=json.load(sys.stdin); t=next(x for x in d["terms"] if x["term"]=="berlines"); assert d["searches"]>=3; assert int(t["searches"])>=3'
RADAR=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/opportunity-radar")
printf '%s' "$RADAR" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(x["term"]=="berlines" and int(x["demand"])>=3 for x in d["opportunities"])'

IMP_END=$(python3 -c 'from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(hours=2)).isoformat())')
IMPULSE=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/businesses/$BUSINESS_ID/impulses" -H "$J" -d "{\"product_id\":$PRODUCT_ID,\"title\":\"Berlines Impulso TEST\",\"price\":1200,\"old_price\":1500,\"stock\":2,\"starts_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"ends_at\":\"$IMP_END\",\"sale_mode\":\"last_units\",\"pickup_enabled\":true,\"delivery_enabled\":false}")
printf '%s' "$IMPULSE" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"] is True; assert d["impulse"]["stock_remaining"]==2'
curl -fsS "$B/market/impulses?business_id=$BUSINESS_ID" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(x["title"]=="Berlines Impulso TEST" for x in d["impulses"])'

ORDER=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":2}]}")
ORDER_ID=$(printf '%s' "$ORDER" | json_value 'd["order"]["id"]')
printf '%s' "$ORDER" | python3 -c 'import sys,json; o=json.load(sys.stdin)["order"]; assert o["subtotal"]==3000; assert o["total"]==3000; assert o["status"]=="new"; assert o["payment_status"]=="pending"'

PAYMENT=$(curl -fsS -b /tmp/dy_market_client "$B/orders/$ORDER_ID/mercadopago/status")
printf '%s' "$PAYMENT" | python3 -c 'import sys,json; d=json.load(sys.stdin); b=d["breakdown"]; assert d["available"] is False; assert d["payment_mode"]=="disconnected"; assert d["live_payments_allowed"] is False; assert b["amount"]==3000; assert b["datoya_fee"]==round(b["amount"]*d["commission_pct"]/100); assert b["seller_net_estimate"]==b["amount"]-b["datoya_fee"]'

CODE=$(curl -sS -o /tmp/dy_market_checkout.json -w '%{http_code}' -b /tmp/dy_market_client -X POST "$B/orders/$ORDER_ID/mercadopago/checkout" -H "$J" -d '{}')
[ "$CODE" = "409" ] || { echo "Checkout sin cuenta Mercado Pago debió responder 409 y respondió $CODE"; cat /tmp/dy_market_checkout.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_market_checkout.json")); assert "Mercado Pago" in d["error"]'

curl -fsS -b /tmp/dy_market_client -X POST "$B/orders/$ORDER_ID/cancel" -H "$J" -d '{}' >/dev/null
STOCK=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/manage" | json_value 'next(p["stock"] for p in d["products"] if p["id"]=='"$PRODUCT_ID"')')
[ "$STOCK" = "5" ] || { echo "El stock no se restituyó al cancelar: $STOCK"; exit 1; }

CLOSED_SCHEDULE=$(python3 - <<'PY'
import json
from datetime import datetime
from zoneinfo import ZoneInfo
keys=['mon','tue','wed','thu','fri','sat','sun']
today=datetime.now(ZoneInfo('America/Santiago')).weekday()
s={k:[] for k in keys}
s[keys[(today+1)%7]]=[{'open':'09:00','close':'10:00'}]
print(json.dumps(s,separators=(',',':')))
PY
)
curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/hours" -H "$J" -d "{\"schedule\":$CLOSED_SCHEDULE,\"accept_orders_when_closed\":false}" >/dev/null
CLOSED_CODE=$(curl -sS -o /tmp/dy_closed_order.json -w '%{http_code}' -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")
[ "$CLOSED_CODE" = "409" ] || { echo "Pedido con negocio cerrado debió responder 409 y respondió $CLOSED_CODE"; cat /tmp/dy_closed_order.json; exit 1; }
python3 -c 'import json; d=json.load(open("/tmp/dy_closed_order.json")); assert d.get("business_closed") is True'

curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/hours" -H "$J" -d "{\"schedule\":$CLOSED_SCHEDULE,\"accept_orders_when_closed\":true}" >/dev/null
AFTER_HOURS=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")
AFTER_HOURS_ID=$(printf '%s' "$AFTER_HOURS" | json_value 'd["order"]["id"]')
curl -fsS -b /tmp/dy_market_client -X POST "$B/orders/$AFTER_HOURS_ID/cancel" -H "$J" -d '{}' >/dev/null

# Restaurar horario abierto para validar atribución de promociones de forma determinista.
curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/hours" -H "$J" -d "{\"schedule\":$ALL_OPEN,\"accept_orders_when_closed\":false}" >/dev/null

# Impulso Ahora: vistas, clics, carrito, pedido y venta completada.
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"impulse_id\":$(printf '%s' "$IMPULSE" | json_value 'd["impulse"]["id"]'),\"event_type\":\"impulse_view\",\"visitor_id\":\"promo-imp-view-$TS\"}" >/dev/null
IMPULSE_ID=$(printf '%s' "$IMPULSE" | json_value 'd["impulse"]["id"]')
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"impulse_id\":$IMPULSE_ID,\"event_type\":\"impulse_click\",\"visitor_id\":\"promo-imp-click-$TS\"}" >/dev/null
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"impulse_id\":$IMPULSE_ID,\"event_type\":\"add_cart\",\"visitor_id\":\"promo-imp-cart-$TS\"}" >/dev/null
IMP_ORDER=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"impulse_id\":$IMPULSE_ID,\"quantity\":1}]}")
IMP_ORDER_ID=$(printf '%s' "$IMP_ORDER" | json_value 'd["order"]["id"]')
for ST in confirmed preparing ready completed; do
  curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/orders/$IMP_ORDER_ID/status" -H "$J" -d "{\"status\":\"$ST\"}" >/dev/null
done

# Impulso de la semana: publicación TEST aprobada y pedido atribuido.
WEEKLY=$(curl -fsS -b /tmp/dy_market_merchant -X POST "$B/weekly-impulses" -H "$J" -d '{"business_id":'"$BUSINESS_ID"',"title":"Caja semanal TEST","description":"Promoción semanal temporal","regular_price":1800,"offer_price":1500,"stock":5,"original_image_data":"data:image/png;base64,iVBORw0KGgo="}')
WEEKLY_ID=$(printf '%s' "$WEEKLY" | json_value 'd["id"]')
WEEK_END=$(python3 -c 'from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(days=7)).isoformat())')
curl -fsS -b /tmp/dy_market_admin -X POST "$B/admin/weekly-impulses/$WEEKLY_ID/approve" -H "$J" -d "{\"placement_type\":\"launch\",\"use_original\":true,\"ends_at\":\"$WEEK_END\"}" >/dev/null
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"weekly_id\":$WEEKLY_ID,\"event_type\":\"weekly_view\",\"visitor_id\":\"promo-week-view-$TS\"}" >/dev/null
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"weekly_id\":$WEEKLY_ID,\"event_type\":\"weekly_click\",\"visitor_id\":\"promo-week-click-$TS\"}" >/dev/null
curl -fsS -X POST "$B/market/promo-event" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"weekly_id\":$WEEKLY_ID,\"event_type\":\"add_cart\",\"visitor_id\":\"promo-week-cart-$TS\"}" >/dev/null
WEEK_ORDER=$(curl -fsS -b /tmp/dy_market_client -X POST "$B/orders" -H "$J" -d "{\"business_id\":$BUSINESS_ID,\"source_weekly_id\":$WEEKLY_ID,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente TEST\",\"customer_phone\":\"+56933334444\",\"items\":[{\"product_id\":$PRODUCT_ID,\"quantity\":1}]}")
WEEK_ORDER_ID=$(printf '%s' "$WEEK_ORDER" | json_value 'd["order"]["id"]')
for ST in confirmed preparing ready completed; do
  curl -fsS -b /tmp/dy_market_merchant -X PUT "$B/businesses/$BUSINESS_ID/orders/$WEEK_ORDER_ID/status" -H "$J" -d "{\"status\":\"$ST\"}" >/dev/null
done

PROMO_ANALYTICS=$(curl -fsS -b /tmp/dy_market_merchant "$B/businesses/$BUSINESS_ID/promotion-analytics?days=30&advanced=1")
printf '%s' "$PROMO_ANALYTICS" | python3 -c 'import sys,json; d=json.load(sys.stdin); a=d["impulse_now"]["summary"]; w=d["weekly"]["summary"]; assert a["impressions"]>=1 and a["clicks"]>=1 and a["add_cart"]>=1 and a["orders"]>=1 and a["completed_orders"]>=1 and a["revenue"]>=1200; assert w["impressions"]>=1 and w["clicks"]>=1 and w["add_cart"]>=1 and w["orders"]>=1 and w["completed_orders"]>=1 and w["revenue"]>=1500'



echo 'DatoYa marketplace payment TEST: OK (sin dinero real)'
