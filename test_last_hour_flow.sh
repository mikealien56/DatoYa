#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:3000
STAMP="$(date +%s)-$$"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
die(){ echo "LAST HOUR FAIL: $1"; exit 1; }
C="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import json,sys;print(json.load(sys.stdin)["comunas"][0]["id"])')"
K="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import json,sys;print(json.load(sys.stdin)["categories"][0]["id"])')"
UNTIL="$(python3 -c 'from datetime import datetime,timedelta,timezone;print((datetime.now(timezone.utc)+timedelta(hours=2)).isoformat())')"
P='LastHour-Aa1-Test-2026!'
OWNER="$TMP/owner"
CUSTOMER="$TMP/customer"
ADMIN="$TMP/admin"
register(){
  local cookie="$1" type="$2" name="$3"
  curl -fsS -c "$cookie" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" -d "{\"name\":\"$name\",\"email\":\"last-$type-$STAMP@datoya.test\",\"password\":\"$P\",\"phone\":\"+56911112222\",\"comuna_id\":$C,\"role\":\"cliente\",\"account_type\":\"$type\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null
  local token
  token="$(curl -fsS -b "$cookie" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}' | python3 -c 'import json,sys;print(json.load(sys.stdin).get("test_token") or "")')"
  [ -n "$token" ] || die "No hay token de verificación para $type"
  curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$token\"}" >/dev/null
}
post_pack(){
  curl -sS -b "$OWNER" -w '%{http_code}' -o "$1" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B/last-hour/packs" -d "{\"product_id\":$PRODUCT,\"packs_available\":3,\"item_count\":5,\"contents\":\"Cinco productos variados de panadería que pueden contener gluten, leche y huevo\",\"price\":$2,\"pickup_until\":\"$UNTIL\"}"
}
echo 'Última Hora 1/8: cuentas y negocio'
register "$OWNER" business NegocioUltimaHora
register "$CUSTOMER" customer ClienteUltimaHora
curl -fsS -c "$ADMIN" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
B="$(curl -fsS -b "$OWNER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"Panadería Última Hora $STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$C,\"category_ids\":[$K],\"address\":\"QA 100\",\"phone\":\"+56922220001\",\"pickup_enabled\":true,\"delivery_enabled\":false}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["business"]["id"])')"
curl -fsS -b "$ADMIN" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$B/status" -d '{"status":"active"}' >/dev/null
PRODUCT="$(curl -fsS -b "$OWNER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B/products" -d "{\"name\":\"Pack sorpresa de panadería\",\"category_id\":$K,\"price\":5000,\"stock_tracking\":true,\"stock\":6,\"active\":true}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["product"]["id"])')"
echo 'Última Hora 2/8: alertas de cliente, opt-in'
curl -fsS -b "$CUSTOMER" -H 'Content-Type: application/json' -X PUT "$BASE/api/last-hour/alerts" -d "{\"enabled\":true,\"comuna_id\":$C}" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["enabled"] and d["comuna_id"]>0'
curl -fsS -b "$CUSTOMER" "$BASE/api/last-hour/alerts" | python3 -c 'import json,sys;assert json.load(sys.stdin)["enabled"]'
echo 'Última Hora 3/8: precio inválido no consume cupo gratis'
CODE="$(post_pack "$TMP/invalid.json" 5000)"
[ "$CODE" = 400 ] || die "Permitió pack sin precio menor al normal: $CODE"
curl -fsS -b "$OWNER" "$BASE/api/businesses/$B/free-monthly-impulse" | python3 -c 'import json,sys;assert json.load(sys.stdin)["available"]'
echo 'Última Hora 4/8: publica pack real, descuento y horario'
CODE="$(post_pack "$TMP/created.json" 2500)"
[ "$CODE" = 201 ] || { cat "$TMP/created.json"; die "Falló publicación del pack $CODE"; }
ID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["impulse_id"])' "$TMP/created.json")"
echo 'Última Hora 5/8: portada pública muestra contenido y stock'
curl -fsS "$BASE/api/market/last-hour?comuna_id=$C" | python3 -c 'import json,sys;d=json.load(sys.stdin);items=[p for p in d["offers"] if p["id"]==int(sys.argv[1])];assert len(items)==1; i=items[0];assert i["is_surprise_pack"] and i["item_count"]==5 and i["stock_remaining"]==3 and i["price"]==2500 and i["pickup_enabled"] and not i["delivery_enabled"]' "$ID"
echo 'Última Hora 6/8: un solo pack mensual gratis'
CODE="$(post_pack "$TMP/repeat.json" 2500)"
[ "$CODE" = 409 ] || die "Duplicó la publicación gratis de Última Hora: $CODE"
echo 'Validar cupo independiente del Impulso gratis'
curl -fsS -b "$OWNER" "$BASE/api/businesses/$B/free-monthly-impulse" | python3 -c 'import json,sys;assert json.load(sys.stdin)["available"],"Última Hora gratis no debe consumir Impulso Ahora gratis"'
curl -fsS -b "$OWNER" "$BASE/api/businesses/$B/last-hour/quota" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["quota"]["tier"]=="free" and d["quota"]["used"]==1 and d["quota"]["remaining"]==0'
echo 'Plan Impulso de un día: dos publicaciones adicionales'
curl -fsS -b "$ADMIN" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/marketplace-v2/growth-plans/gift" -d "{\"business_id\":$B,\"tier\":\"impulso\",\"days\":1}" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"]'
curl -fsS -b "$OWNER" "$BASE/api/businesses/$B/last-hour/quota" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["quota"]["tier"]=="impulso" and d["quota"]["limit"]==2 and d["quota"]["remaining"]==2 and d["free_month"]["remaining"]==0'
for n in 1 2; do
  CODE="$(post_pack "$TMP/paid$n.json" 2000)"
  [ "$CODE" = 201 ] || { cat "$TMP/paid$n.json"; die "Impulso no publicó el pack $n ($CODE)"; }
done
CODE="$(post_pack "$TMP/paid_excess.json" 2000)"
[ "$CODE" = 409 ] || die "Impulso permitió más packs que los incluidos ($CODE)"
curl -fsS -b "$OWNER" "$BASE/api/businesses/$B/last-hour/quota" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["quota"]["used"]==2 and d["quota"]["remaining"]==0'
echo 'Última Hora 7/8: agotamiento saca la tarjeta de la sección'
curl -fsS -b "$OWNER" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$B/impulses/$ID/stock" -d '{"stock_remaining":0}' >/dev/null
curl -fsS "$BASE/api/market/last-hour?comuna_id=$C" | python3 -c 'import json,sys;assert int(sys.argv[1]) not in [p["id"] for p in json.load(sys.stdin)["offers"]]' "$ID"
echo 'Última Hora 8/8: el cliente puede desactivar alertas'
curl -fsS -b "$CUSTOMER" -H 'Content-Type: application/json' -X PUT "$BASE/api/last-hour/alerts" -d "{\"enabled\":false,\"comuna_id\":$C}" | python3 -c 'import json,sys;assert not json.load(sys.stdin)["enabled"]'
echo '✅ ÚLTIMA HORA E2E OK'
