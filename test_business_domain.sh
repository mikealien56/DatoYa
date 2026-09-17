#!/bin/bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
MERCHANT_COOKIE=/tmp/datoya-business-merchant.cookie
ADMIN_COOKIE=/tmp/datoya-business-admin.cookie
rm -f "$MERCHANT_COOKIE" "$ADMIN_COOKIE"

curl -fsS -c "$MERCHANT_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Comerciante QA","email":"merchant.qa@datoya.test","password":"PruebaSegura123"}' "$BASE_URL/api/auth/register" >/dev/null
CATEGORIES="$(curl -fsS "$BASE_URL/api/business-categories")"
PASTRY_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const c=x.categories.find(v=>v.slug==="pastelerias");if(!c)process.exit(1);process.stdout.write(String(c.id))' "$CATEGORIES")"
COMUNAS="$(curl -fsS "$BASE_URL/api/comunas")"
DONIHUE_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const c=x.comunas.find(v=>v.name==="Doñihue");if(!c)process.exit(1);process.stdout.write(String(c.id))' "$COMUNAS")"
REGION_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const c=x.comunas.find(v=>v.name==="Doñihue");process.stdout.write(String(c.region_id))' "$COMUNAS")"

HOME_CREATED="$(curl -fsS -b "$MERCHANT_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Dulce Hogar QA","business_type":"home_business"}' "$BASE_URL/api/businesses")"
HOME_ID="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).business.id))' "$HOME_CREATED")"
HOME_SLUG="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).business.slug)' "$HOME_CREATED")"
curl -fsS -b "$MERCHANT_COOKIE" -X PUT -H 'Content-Type: application/json' -d "{\"main_category_id\":$PASTRY_ID,\"category_ids\":[$PASTRY_ID],\"region_id\":$REGION_ID,\"comuna_id\":$DONIHUE_ID,\"latitude\":-34.226,\"longitude\":-70.965,\"location_accuracy\":15,\"address\":\"Casa QA 123\",\"sector\":\"Sector aproximado QA\",\"public_location_mode\":\"approximate\",\"show_exact_address\":false,\"pickup_enabled\":true}" "$BASE_URL/api/businesses/$HOME_ID" >/dev/null
PRODUCT="$(curl -fsS -b "$MERCHANT_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Berlines caseros QA","price":1500,"stock":50,"stock_tracking":true}' "$BASE_URL/api/businesses/$HOME_ID/products")"
node -e 'const p=JSON.parse(process.argv[1]).product;if(p.stock!==50&&Number(p.stock)!==50)process.exit(1)' "$PRODUCT"
curl -fsS -b "$MERCHANT_COOKIE" -X POST "$BASE_URL/api/businesses/$HOME_ID/submit" >/dev/null

STORE_CREATED="$(curl -fsS -b "$MERCHANT_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Local Físico QA","business_type":"physical_store"}' "$BASE_URL/api/businesses")"
STORE_ID="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).business.id))' "$STORE_CREATED")"
curl -fsS -b "$MERCHANT_COOKIE" -X PUT -H 'Content-Type: application/json' -d "{\"main_category_id\":$PASTRY_ID,\"category_ids\":[$PASTRY_ID],\"region_id\":$REGION_ID,\"comuna_id\":$DONIHUE_ID,\"latitude\":-34.225,\"longitude\":-70.964,\"address\":\"Local QA 456\",\"show_exact_address\":true}" "$BASE_URL/api/businesses/$STORE_ID" >/dev/null
curl -fsS -b "$MERCHANT_COOKIE" -X POST "$BASE_URL/api/businesses/$STORE_ID/submit" >/dev/null

curl -fsS -c "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "$BASE_URL/api/auth/login" >/dev/null
for id in "$HOME_ID" "$STORE_ID";do curl -fsS -b "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"status":"active"}' "$BASE_URL/api/admin/businesses/$id/status" >/dev/null;done

PUBLIC="$(curl -fsS "$BASE_URL/api/businesses/$HOME_SLUG?lat=-34.220&lng=-70.960")"
node -e 'const b=JSON.parse(process.argv[1]).business;if(!b.address_protected||b.address||b.latitude||b.longitude)process.exit(1);if(b.comuna_name!=="Doñihue")process.exit(1)' "$PUBLIC"
SEARCH="$(curl -fsS "$BASE_URL/api/search?q=berlines&lat=-34.220&lng=-70.960&radius=5")"
node -e 'const x=JSON.parse(process.argv[1]);if(!x.results.some(r=>r.type==="product"&&r.name==="Berlines caseros QA"&&Number(r.price)===1500))process.exit(1)' "$SEARCH"
echo 'Business domain smoke OK: physical store, protected home business, product search and distance'
