#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
rm -f datoya.db datoya.db-shm datoya.db-wal
PORT=3101 DEMO_MODE=false npm start >/tmp/datoya-real.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for i in $(seq 1 90); do
  curl -fsS http://localhost:3101/health >/dev/null 2>&1 && break
  if ! kill -0 "$PID" >/dev/null 2>&1; then cat /tmp/datoya-real.log; exit 1; fi
  sleep 1
done
curl -fsS http://localhost:3101/health | grep -q '"ok":true'
CATS=$(curl -fsS http://localhost:3101/api/categories)
printf '%s' "$CATS" | grep -q 'Gasf'
# El admin conocido de DEMO no debe existir.
STATUS=$(curl -s -o /tmp/demo-login.json -w '%{http_code}' -c /tmp/demo-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.cl","password":"demo1234"}' \
  http://localhost:3101/api/auth/login)
[ "$STATUS" = "401" ] || { echo "La cuenta admin DEMO sigue disponible en modo real"; cat /tmp/demo-login.json; exit 1; }
# Un cliente real nuevo debe poder registrarse.
STATUS=$(curl -s -o /tmp/real-register.json -w '%{http_code}' -c /tmp/real-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"name":"Beta Real","email":"beta.real@example.com","password":"clave-segura-123","role":"cliente"}' \
  http://localhost:3101/api/auth/register)
[ "$STATUS" = "200" ] || [ "$STATUS" = "201" ] || { echo "Registro real falló HTTP $STATUS"; cat /tmp/real-register.json; exit 1; }
ME=$(curl -fsS -b /tmp/real-cookies.txt http://localhost:3101/api/auth/me)
printf '%s' "$ME" | grep -q 'beta.real@example.com'
if grep -q 'Sembrando datos DEMO' /tmp/datoya-real.log; then echo "Se ejecutó seed DEMO con DEMO_MODE=false"; cat /tmp/datoya-real.log; exit 1; fi
echo "Modo beta real OK: sin cuentas DEMO y con registro funcional"
