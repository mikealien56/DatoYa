#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
PASS="BetaReady-$(date +%s)-Aa1!"
STAMP="$(date +%s)-$$"
TMP="$(mktemp -d)"
B="$TMP/business"; A="$TMP/admin"
trap 'rm -rf "$TMP"' EXIT
fail(){ echo "BETA READINESS E2E FAIL: $1"; exit 1; }

COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; print(json.load(sys.stdin)["comunas"][0]["id"])')"
CATEGORY_ID="$(curl -fsS "$BASE/api/market/categories" | python3 -c 'import sys,json; print(json.load(sys.stdin)["categories"][0]["id"])')"
MAIL="beta-ready-$STAMP@datoya.test"
NAME="BetaReady$STAMP"

curl -fsS -c "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register"   -d "{\"name\":\"Encargado Beta\",\"email\":\"$MAIL\",\"password\":\"$PASS\",\"phone\":\"+56911112222\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"business\",\"accept_terms\":true,\"accept_privacy\":true}" >/dev/null
TOKEN="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get("test_token") or "")')"
[ -n "$TOKEN" ] || fail "sin token de verificación"
curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$TOKEN\"}" >/dev/null

BJSON="$(curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses"   -d "{\"name\":\"$NAME\",\"description\":\"Negocio readiness QA\",\"business_type\":\"physical_store\",\"comuna_id\":$COMUNA_ID,\"category_ids\":[$CATEGORY_ID],\"sector\":\"Centro QA\",\"address\":\"QA 123\",\"public_address_mode\":\"approximate\",\"phone\":\"+56922223333\",\"whatsapp\":\"+56922223333\",\"pickup_enabled\":true,\"delivery_enabled\":false}")"
BID="$(printf '%s' "$BJSON"|python3 -c 'import sys,json; print(json.load(sys.stdin)["business"]["id"])')"

echo "1/4 Pendiente no está listo"
curl -fsS -b "$B" "$BASE/api/businesses/$BID/readiness" | python3 -c 'import sys,json; r=json.load(sys.stdin)["readiness"]; assert r["ready"] is False; assert any(x["key"]=="approved" and not x["ok"] for x in r["checks"]); assert any(x["key"]=="hours" and not x["ok"] for x in r["checks"])'

: "${ADMIN_EMAIL:?}" "${ADMIN_PASSWORD:?}"
curl -fsS -c "$A" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
curl -fsS -b "$A" -H 'Content-Type: application/json' -X PUT "$BASE/api/admin/marketplace/businesses/$BID/status" -d '{"status":"active"}' >/dev/null

echo "2/4 Producto sin horario todavía no basta"
curl -fsS -b "$B" -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BID/products"   -d "{\"name\":\"Producto Beta\",\"category_id\":$CATEGORY_ID,\"price\":4990,\"stock_tracking\":true,\"stock\":5,\"active\":true}" >/dev/null
curl -fsS -b "$B" "$BASE/api/businesses/$BID/readiness" | python3 -c 'import sys,json; r=json.load(sys.stdin)["readiness"]; assert r["ready"] is False; assert r["products"]["visible"]==1; assert any(x["key"]=="hours" and not x["ok"] for x in r["checks"])'

echo "3/4 Al configurar horarios queda listo"
curl -fsS -b "$B" -H 'Content-Type: application/json' -X PUT "$BASE/api/businesses/$BID/hours"   -d '{"schedule":{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[],"sun":[]},"accept_orders_when_closed":true}' >/dev/null
curl -fsS -b "$B" "$BASE/api/businesses/$BID/readiness" | python3 -c 'import sys,json; r=json.load(sys.stdin)["readiness"]; assert r["ready"] is True and r["complete"]==r["total"]==6; assert r["products"]["recommended_met"] is False'

echo "4/4 Admin Control Beta refleja el estado"
curl -fsS -b "$A" "$BASE/api/admin/beta-launch" | python3 -c "import sys,json; d=json.load(sys.stdin); r=next(x for x in d['businesses'] if int(x['business']['id'])==int('$BID')); assert r['ready'] is True; assert d['metrics']['ready']>=1; assert 'invitations' in d['metrics']"

echo "✅ BETA READINESS E2E OK: registro → aprobación → producto → horarios → listo"
