#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== DatoYa CI base: marketplace comercial ==="

# 1) Sintaxis de todo el runtime actual.
for js in *.js; do
  node --check "$js" >/dev/null || { echo "Error de sintaxis en $js"; exit 1; }
done
echo "✅ Sintaxis JavaScript"

# 2) El Home debe arrancar por la capa comercial, no por trabajadores.
grep -q "__datoyaRenderMarketHome" app.js || { echo "app.js no delega el Home al marketplace"; exit 1; }
grep -q "__datoyaRenderMarketHome=renderMarketShell" local_market_home.js || { echo "El shell comercial no está montado"; exit 1; }
grep -q "dy-market-boot-shield" local_market_home_assets.js || { echo "Falta protección visual del arranque comercial"; exit 1; }
grep -q "marketplace_legacy_route_guard" marketplace_public_shell_assets.js || { echo "Falta guard de rutas legacy"; exit 1; }
echo "✅ Arranque comercial protegido"

# 3) Territorio / GPS.
node test_territory_location.js
echo "✅ Resolución territorial"

# 4) Base SQLite limpia para pruebas de runtime.
rm -f datoya.db datoya.db-shm datoya.db-wal
if [ ! -d node_modules ]; then npm ci --silent; fi

# La verificación de correo usa tokens solo dentro de CI.
export AUTH_TEST_MODE=true
export DEMO_MODE=false
export ADMIN_EMAIL="admin-ci@datoya.invalid"
export ADMIN_PASSWORD="DatoYa-CI-Admin-2026"
export PORT=3000

npm start >/tmp/datoya-ci.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1||true; wait "$PID" >/dev/null 2>&1||true; }
trap cleanup EXIT

READY=0
for i in $(seq 1 120); do
  if curl -fsS http://localhost:3000/api/market/categories >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "Servidor DatoYa no pudo iniciar"; cat /tmp/datoya-ci.log; exit 1
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then echo "Timeout esperando DatoYa"; cat /tmp/datoya-ci.log; exit 1; fi

curl -fsS http://localhost:3000/health | grep -q '"ok":true'
CATS=$(curl -fsS http://localhost:3000/api/market/categories | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["categories"]))')
[ "$CATS" -ge 19 ] || { echo "Catálogo comercial incompleto: $CATS"; exit 1; }
echo "✅ Healthcheck + categorías comerciales"

# 5) Rutas privadas del marketplace no deben abrir sin sesión.
for path in businesses/mine orders/mine; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/$path")
  [ "$code" = "401" ] || { echo "Ruta privada incorrecta /api/$path HTTP $code"; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/admin/marketplace/businesses")
[ "$code" = "401" ] || { echo "Admin marketplace no está protegido HTTP $code"; exit 1; }
echo "✅ Autorización base"

# 6) Assets que definen la beta comercial.
for asset in   local_market_home.js marketplace_account_ui.js marketplace_public_beta_ui.js   marketplace_business_ui.js marketplace_commerce_ui.js marketplace_payments_ui.js   marketplace_growth_ui.js marketplace_hours_ui.js marketplace_guided_demo_ui.js   marketplace_demo_showcase_ui.js marketplace_demo_pitch_ui.js marketplace_legacy_route_guard.js   marketplace_growth.css marketplace_hours.css marketplace_guided_demo.css   brand/datoya-logo-horizontal.png; do
  curl -fsS "http://localhost:3000/$asset" >/dev/null || { echo "Archivo estático no publicado: $asset"; exit 1; }
done
echo "✅ Frontend comercial publicado"

# 7) Marcadores críticos del backend nuevo.
for marker in   "DATOYA MARKETPLACE ACCOUNT V2"   "DATOYA MARKET PRODUCTS V1"   "DATOYA COMMERCE BETA V1"   "DATOYA MARKETPLACE PAYMENTS V1"   "DATOYA GROWTH COMMERCIAL V1"   "DATOYA STRUCTURED HOURS V1"; do
  grep -q "$marker" server.js || { echo "Runtime comercial no montado: $marker"; exit 1; }
done
echo "✅ Backend marketplace montado"

# 8) Regresiones de seguridad que siguen siendo compartidas por la plataforma.
bash test_security_regression.sh
node marketplace_beta_smoketest.js

echo "DatoYa marketplace CI: OK"
