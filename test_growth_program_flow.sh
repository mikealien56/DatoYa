#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
STAMP="$(date +%s)-$$"
PASS="Growth-${STAMP}-Aa1!"
TMP="$(mktemp -d)"
C="$TMP/client"; F="$TMP/founder"; R="$TMP/referred"; A="$TMP/admin"
trap 'rm -rf "$TMP"' EXIT
fail(){ echo "GROWTH E2E FAIL: $1"; exit 1; }

COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; print(json.load(sys.stdin)["comunas"][0]["id"])')"
CATEGORY_ID="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; print(json.load(sys.stdin)["categories"][0]["id"])')"

register(){
  local jar="$1" mail="$2" type="$3" name="$4"
  curl -fsS -c "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" -d "{\"name\":\"$name\",\"email\":\"$mail\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null
  local payload token
  payload="$(curl -fsS -b "$jar" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}')"
  token="$(printf '%s' "$payload"|python3 -c 'import sys,json;print(json.load(sys.stdin).get("test_token") or "")')"
  [ -n "$token" ] || fail "sin token de verificación"
  curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" >/dev/null
}

register "$C" "growth-client-$STAMP@datoya.test" customer "Cliente Growth"
register "$F" "growth-founder-$STAMP@datoya.test" business "Fundador Growth"
register "$R" "growth-referred-$STAMP@datoya.test" business "Referido Growth"

: "${ADMIN_EMAIL:?}" "${ADMIN_PASSWORD:?}"
curl -fsS -c "$A" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

echo "1/9 Admin crea invitación Fundador"
INVITE="FUNDADOR-$(echo "$STAMP"|tr -cd '[:alnum:]'|cut -c1-16)"
curl -fsS -b "$A" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/marketplace-v2/founder-invites" -d "{\"code\":\"$INVITE\",\"label\":\"Fundador QA\",\"max_uses\":1}" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['invite']['code']=='$INVITE'"

echo "2/9 Negocio entra con invitación y queda marcado como Fundador"
FJSON="$(curl -fsS -b "$F" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"Fundador$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"address\":\"QA 100\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922220001\",\"whatsapp\":\"+56922220001\",\"pickup_enabled\":true,\"delivery_enabled\":false,\"invitation_code\":\"$INVITE\"}")"
FBIZ="$(printf '%s' "$FJSON"|python3 -c 'import sys,json;print(json.load(sys.stdin)["business"]["id"])')"
curl -fsS -b "$A" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$FBIZ/status" -d '{"status":"active"}' >/dev/null
FOUNDERS="$(curl -fsS -b "$A" "$BASE/api/admin/marketplace-v2/founders")"
FCODE="$(printf '%s' "$FOUNDERS"|python3 -c "import sys,json;d=json.load(sys.stdin);f=next(x for x in d['founders'] if int(x['business_id'])==int('$FBIZ'));assert int(f['is_founder'])==1;print(f['founder_code'])")"
[ -n "$FCODE" ] || fail "Fundador quedó sin código personal"
curl -fsS -b "$F" "$BASE/api/businesses/$FBIZ/impulso-plan" | python3 -c 'import sys,json;d=json.load(sys.stdin);m=d["membership"];assert m and int(m["days_granted"])==30'

echo "3/9 Fundador crea promo exclusiva Solo en DatoYa"
PJSON="$(curl -fsS -b "$F" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$FBIZ/products" -d "{\"name\":\"Promo Fundador\",\"category_id\":$CATEGORY_ID,\"price\":25000,\"promo_price\":20000,\"stock_tracking\":true,\"stock\":20,\"active\":true}")"
PROD="$(printf '%s' "$PJSON"|python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])')"
curl -fsS -b "$F" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$FBIZ/products/$PROD/datoya-exclusive" -d '{"active":true}' | python3 -c 'import sys,json;assert json.load(sys.stdin)["datoya_exclusive"] is True'

echo "4/9 Primeros cinco pedidos quedan con 0% de comisión"
for N in 1 2 3 4 5; do
  curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "{\"business_id\":$FBIZ,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Growth\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"growth-free-$STAMP-$N\",\"items\":[{\"product_id\":$PROD,\"quantity\":1}]}" | python3 -c 'import sys,json;d=json.load(sys.stdin)["order"];assert int(d["datoya_commission_estimate"])==0 and int(d["launch_free_order"])==1 and d["commission_tier"]=="lanzamiento-0"'
done

echo "5/9 Sexto pedido usa 2,9% por Impulso + exclusiva"
SIXTH="$(curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "{\"business_id\":$FBIZ,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Growth\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"growth-sixth-$STAMP\",\"items\":[{\"product_id\":$PROD,\"quantity\":1}]}")"
printf '%s' "$SIXTH" | python3 -c 'import sys,json;d=json.load(sys.stdin)["order"];assert int(d["commission_base"])==20000 and int(d["datoya_commission_estimate"])==580 and float(d["commission_rate_effective"])==2.9 and d["commission_tier"]=="impulso-exclusiva" and int(d["commission_cap"])==1990 and int(d["exclusive_subtotal"])==20000'

echo "6/9 Referido entra con el código personal del Fundador"
RJSON="$(curl -fsS -b "$R" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"Referido$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"address\":\"QA 200\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922220002\",\"whatsapp\":\"+56922220002\",\"pickup_enabled\":true,\"delivery_enabled\":false,\"invitation_code\":\"$FCODE\"}")"
RBIZ="$(printf '%s' "$RJSON"|python3 -c 'import sys,json;print(json.load(sys.stdin)["business"]["id"])')"
curl -fsS -b "$A" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$RBIZ/status" -d '{"status":"active"}' >/dev/null
curl -fsS -b "$A" "$BASE/api/admin/marketplace-v2/founders" >/dev/null
curl -fsS -b "$R" "$BASE/api/businesses/$RBIZ/growth-program" | python3 -c "import sys,json;d=json.load(sys.stdin);p=d['profile'];assert int(p['referred_by_business_id'])==int('$FBIZ') and int(p['launch_free_order_limit'])==5"
curl -fsS -b "$R" "$BASE/api/businesses/$RBIZ/impulso-plan" | python3 -c 'import sys,json;d=json.load(sys.stdin);m=d["membership"];assert m and int(m["days_granted"])==15'

echo "7/9 Referido crea producto para completar cinco pedidos reales"
RPJSON="$(curl -fsS -b "$R" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$RBIZ/products" -d "{\"name\":\"Producto Referido\",\"category_id\":$CATEGORY_ID,\"price\":5000,\"stock_tracking\":true,\"stock\":10,\"active\":true}")"
RPROD="$(printf '%s' "$RPJSON"|python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])')"

echo "8/9 Al quinto pedido completado se premia al Fundador"
for N in 1 2 3 4 5; do
  OJSON="$(curl -fsS -b "$C" -H 'Content-Type: application/json' -X POST "$BASE/api/orders" -d "{\"business_id\":$RBIZ,\"fulfillment_method\":\"pickup\",\"customer_name\":\"Cliente Growth\",\"customer_phone\":\"+56911112222\",\"client_request_id\":\"growth-ref-$STAMP-$N\",\"items\":[{\"product_id\":$RPROD,\"quantity\":1}]}")"
  OID="$(printf '%s' "$OJSON"|python3 -c 'import sys,json;print(json.load(sys.stdin)["order"]["id"])')"
  PCODE="$(curl -fsS -b "$C" "$BASE/api/orders/mine" | python3 -c "import sys,json;o=next(x for x in json.load(sys.stdin)['orders'] if int(x['id'])==int('$OID'));print(o['pickup_code'])")"
  for STATE in confirmed preparing ready; do
    curl -fsS -b "$R" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$RBIZ/orders/$OID/status" -d "{\"status\":\"$STATE\"}" >/dev/null
  done
  curl -fsS -b "$R" -H 'Content-Type: application/json' -X POST "$BASE/api/orders/$OID/pickup/verify" -d "{\"code\":\"$PCODE\"}" >/dev/null
done
curl -fsS -b "$A" "$BASE/api/admin/marketplace-v2/founders" | python3 -c "import sys,json;d=json.load(sys.stdin);r=next(x for x in d['referrals'] if int(x['referred_business_id'])==int('$RBIZ'));f=next(x for x in d['founders'] if int(x['business_id'])==int('$FBIZ'));assert r['status']=='rewarded' and int(r['completed_orders'])==5 and int(r['reward_days'])==15 and int(f['founder_reward_days'])==15"

echo "9/9 Código Fundador de un solo uso no puede reutilizarse"
CODE="$(curl -s -o "$TMP/reused" -w '%{http_code}' -b "$R" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"NoDebeEntrar$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"invitation_code\":\"$INVITE\"}")"
[ "$CODE" = "400" ] || fail "invitación Fundador reutilizada HTTP $CODE"

echo "✅ GROWTH E2E OK: Fundador + referido + 0% inicial + Solo en DatoYa + premio por 5 pedidos"
