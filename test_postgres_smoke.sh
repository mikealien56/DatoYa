#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

export DEMO_MODE=false
export DB_DRIVER=postgres
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/datoya_test}"
export PORT="${PORT:-3000}"

npm start >/tmp/datoya-pg.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

READY=0
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then READY=1; break; fi
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

echo "PostgreSQL startup OK"

CATS=$(curl -fsS "http://127.0.0.1:${PORT}/api/categories")
printf '%s' "$CATS" | grep -q 'Gasfíter'
printf '%s' "$CATS" | grep -q 'Electricista'

echo "Catálogo PostgreSQL OK"

DEMO_STATUS=$(curl -s -o /tmp/demo-login.json -w '%{http_code}' -X POST "http://127.0.0.1:${PORT}/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"admin@demo.cl","password":"demo1234"}')
if [ "$DEMO_STATUS" = "200" ]; then
  echo "ERROR: admin DEMO existe en PostgreSQL real"
  cat /tmp/demo-login.json
  exit 1
fi

curl -fsS -c /tmp/client.cookies -X POST "http://127.0.0.1:${PORT}/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cliente Real PG","email":"cliente.pg@datoya.test","password":"Prueba123","role":"cliente"}' >/tmp/client-register.json

grep -q 'cliente' /tmp/client-register.json
curl -fsS -b /tmp/client.cookies "http://127.0.0.1:${PORT}/api/auth/me" | grep -q 'cliente.pg@datoya.test'

curl -fsS -c /tmp/worker.cookies -X POST "http://127.0.0.1:${PORT}/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Profesional Real PG","email":"worker.pg@datoya.test","password":"Prueba123","role":"trabajador"}' >/tmp/worker-register.json

grep -q 'trabajador' /tmp/worker-register.json
curl -fsS -b /tmp/worker.cookies "http://127.0.0.1:${PORT}/api/auth/me" | grep -q 'worker.pg@datoya.test'

echo "Registro/sesiones PostgreSQL OK"
echo "DatoYa PostgreSQL smoke: OK"
