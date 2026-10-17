#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:3000"
STAMP="$(date +%s)-$$"; TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
die(){ echo "FREE IMPULSE E2E FAIL: $1"; exit 1; }
C="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json;print(json.load(sys.stdin)["comunas"][0]["id"])')"
K="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json;print(json.load(sys.stdin)["categories"][0]["id"])')"
PASS="FreePulse-$STAMP-Aa1!"; EMAIL="free-impulse-$STAMP@datoya.test"
USER="$TMP/owner"; ADMIN="$TMP/admin"
curl -fsS -c "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register" -d "{\"name\":\"Impulso QA\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$C,\"role\":\"cliente\",\"account_type\":\"business\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null
TOKEN="$(curl -fsS -b "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("test_token") or "")')"
[ -n "$TOKEN" ] || die "email sin token"
curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$TOKEN\"}" >/dev/null
curl -fsS -c "$ADMIN" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
new_business(){
  curl -fsS -b "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses" -d "{\"name\":\"FreePulse-$1-$STAMP\",\"business_type\":\"physical_store\",\"comuna_id\":$C,\"category_ids\":[$K],\"address\":\"QA 100\",\"phone\":\"+56922220001\",\"pickup_enabled\":true,\"delivery_enabled\":false}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["business"]["id"])'
}
new_product(){
  curl -fsS -b "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$1/products" -d "{\"name\":\"Producto QA\",\"category_id\":$K,\"price\":$2,\"stock_tracking\":true,\"stock\":12,\"active\":true}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["product"]["id"])'
}
B1="$(new_business one)"
curl -fsS -b "$ADMIN" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$B1/status" -d '{"status":"active"}' >/dev/null
P1="$(new_product "$B1" 20000)"
echo "Free impulse source diagnostic:"
grep -n 'DATOYA_FREE_MONTHLY_IMPULSE_V1' server.js | head -n 4 || true
grep -n "app.get('/api/businesses/:id/free-monthly-impulse'" server.js | head -n 2 || true
grep -n "app.use((req, res) => res.sendFile" server.js | head -n 2 || true
grep -n "app.get('/api/market/impulses'" server.js | head -n 2 || true
echo "1/6 Cupo mensual Plan Gratis"
curl -sS -b "$USER" -D "$TMP/headers" "$BASE/api/businesses/$B1/free-monthly-impulse" -o "$TMP/first-response"
head -n 8 "$TMP/headers"
head -c 240 "$TMP/first-response"; echo
python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));assert d["is_free_plan"] and d["available"] and d["duration_hours"]==24 and not d["used"]' "$TMP/first-response"
echo "2/6 Descuento inválido no consume cupo"
CODE="$(curl -s -b "$USER" -o "$TMP/invalid" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B1/free-monthly-impulse" -d "{\"product_id\":$P1,\"mode\":\"liquidation\",\"offer_price\":20000,\"stock\":3}")"
[ "$CODE" = "400" ] || die "aceptó liquidación sin descuento $CODE"
curl -fsS -b "$USER" "$BASE/api/businesses/$B1/free-monthly-impulse" | python3 -c 'import sys,json;assert json.load(sys.stdin)["available"]'
echo "3/6 Destacar sin descuento por 24 horas"
curl -fsS -b "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B1/free-monthly-impulse" -d "{\"product_id\":$P1,\"mode\":\"highlight\",\"stock\":3}" | python3 -c 'import sys,json,datetime;d=json.load(sys.stdin);assert d["ok"] and d["mode"]=="highlight";s=datetime.datetime.fromisoformat(d["starts_at"].replace("Z","+00:00"));e=datetime.datetime.fromisoformat(d["ends_at"].replace("Z","+00:00"));assert (e-s).total_seconds()==86400'
curl -fsS -b "$USER" "$BASE/api/businesses/$B1/impulses" | python3 -c 'import sys,json;rows=json.load(sys.stdin)["impulses"];p=next(x for x in rows if x["reference"].startswith("FIMP-"));assert p["sale_mode"]=="normal" and p["old_price"] is None and p["price"]==20000'
echo "4/6 Segundo Impulso del mes bloqueado"
CODE="$(curl -s -b "$USER" -o "$TMP/repeat" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B1/free-monthly-impulse" -d "{\"product_id\":$P1,\"mode\":\"highlight\",\"stock\":3}")"
[ "$CODE" = "409" ] || die "permitió repetir Impulso: $CODE"
curl -fsS -b "$USER" "$BASE/api/businesses/$B1/free-monthly-impulse" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["used"] and not d["available"]'
echo "5/6 Segundo negocio, cupo propio"
B2="$(new_business two)"
curl -fsS -b "$ADMIN" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$B2/status" -d '{"status":"active"}' >/dev/null
P2="$(new_product "$B2" 18000)"
curl -fsS -b "$USER" "$BASE/api/businesses/$B2/free-monthly-impulse" | python3 -c 'import sys,json;assert json.load(sys.stdin)["available"]'
echo "6/6 Liquidación con precio real rebajado"
curl -fsS -b "$USER" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$B2/free-monthly-impulse" -d "{\"product_id\":$P2,\"mode\":\"liquidation\",\"offer_price\":12000,\"stock\":5}" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["ok"] and d["mode"]=="liquidation"'
curl -fsS -b "$USER" "$BASE/api/businesses/$B2/impulses" | python3 -c 'import sys,json;rows=json.load(sys.stdin)["impulses"];p=next(x for x in rows if x["reference"].startswith("FIMP-"));assert p["sale_mode"]=="liquidation" and p["old_price"]==18000 and p["price"]==12000'
echo "✅ FREE MONTHLY IMPULSE E2E OK"
