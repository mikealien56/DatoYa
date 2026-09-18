#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

export DEMO_MODE=false
export DB_DRIVER=postgres
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/datoya_test}"
export PORT="${PORT:-3000}"
export AUTH_TEST_MODE=true
export ADMIN_EMAIL="admin-pg-smoke@datoya.invalid"
export ADMIN_PASSWORD="DatoYa-PG-Smoke-2026"

node production_start.js >/tmp/datoya-pg.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

READY=0
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/market/categories" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "DatoYa PostgreSQL no pudo iniciar"
    cat /tmp/datoya-pg.log
    exit 1
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "Timeout iniciando DatoYa PostgreSQL"
  cat /tmp/datoya-pg.log
  exit 1
fi

curl -fsS "http://127.0.0.1:${PORT}/health" | grep -q '"ok":true'
echo "PostgreSQL startup OK"

MARKET_CATS=$(curl -fsS "http://127.0.0.1:${PORT}/api/market/categories")
printf '%s' "$MARKET_CATS" | python3 -c 'import sys,json; d=json.load(sys.stdin)["categories"]; assert len(d)>=19; assert any(x["name"]=="Pastelerías" for x in d)'
echo "Catálogo marketplace PostgreSQL OK"

COMUNAS=$(curl -fsS "http://127.0.0.1:${PORT}/api/comunas")
COMUNA_ID=$(printf '%s' "$COMUNAS" | python3 -c 'import sys,json; d=json.load(sys.stdin)["comunas"]; print(next(x["id"] for x in d if x["name"]=="Doñihue"))')

# No deben existir las antiguas cuentas DEMO reales.
DEMO_STATUS=$(curl -s -o /tmp/demo-login.json -w '%{http_code}' -X POST "http://127.0.0.1:${PORT}/api/auth/login"   -H 'Content-Type: application/json' -d '{"email":"admin@demo.cl","password":"demo1234"}')
[ "$DEMO_STATUS" != "200" ] || { echo "ERROR: admin DEMO existe en PostgreSQL real"; cat /tmp/demo-login.json; exit 1; }

STAMP="$(date +%s%N)"
EMAIL="merchant-pg-smoke-${STAMP}@datoya.invalid"
curl -fsS -c /tmp/pg-smoke.cookies -X POST "http://127.0.0.1:${PORT}/api/auth/register"   -H 'Content-Type: application/json'   -d "{\"name\":\"Comerciante PostgreSQL TEST\",\"email\":\"$EMAIL\",\"password\":\"DatoYa-Test-2026\",\"phone\":\"+56911112222\",\"role\":\"cliente\",\"comuna_id\":$COMUNA_ID}" >/tmp/pg-smoke-register.json
grep -q '"ok":true' /tmp/pg-smoke-register.json
curl -fsS -b /tmp/pg-smoke.cookies "http://127.0.0.1:${PORT}/api/auth/me" | grep -q "$EMAIL"

# Rutas marketplace privadas deben exigir sesión.
for path in businesses/mine orders/mine; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/$path")
  [ "$CODE" = "401" ] || { echo "Ruta /api/$path debió responder 401 y respondió $CODE"; exit 1; }
done

# Rutas públicas comerciales deben responder.
curl -fsS "http://127.0.0.1:${PORT}/api/market/businesses" | grep -q '"businesses"'
curl -fsS "http://127.0.0.1:${PORT}/api/market/products" | grep -q '"products"'

grep -q "Fundadores, QR, URLs compartibles y analítica comercial preparados" /tmp/datoya-pg.log
grep -q "Horarios estructurados y control de pedidos fuera de horario preparados" /tmp/datoya-pg.log
grep -q "\[DatoYa\]\[Beta smoke\] OK" /tmp/datoya-pg.log

echo "Registro/sesión marketplace PostgreSQL OK"
echo "DatoYa PostgreSQL marketplace smoke: OK"
