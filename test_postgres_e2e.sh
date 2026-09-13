#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

export DEMO_MODE=false
export DB_DRIVER=postgres
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/datoya_test}"
export PORT="${PORT:-3000}"
B="http://127.0.0.1:${PORT}/api"
J="Content-Type: application/json"

npm start >/tmp/datoya-pg-e2e.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
on_error(){ echo '=== LOG SERVIDOR POSTGRESQL E2E ==='; tail -160 /tmp/datoya-pg-e2e.log || true; }
trap cleanup EXIT
trap on_error ERR

READY=0
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then cat /tmp/datoya-pg-e2e.log; exit 1; fi
  sleep 1
done
[ "$READY" -eq 1 ] || { cat /tmp/datoya-pg-e2e.log; exit 1; }

echo "=== PostgreSQL E2E real ==="
CAT=$(curl -fsS "$B/categories" | python3 -c 'import sys,json; d=json.load(sys.stdin)["categories"]; print(next(x["id"] for x in d if x["name"]=="Gasfíter"))')
COMUNA=$(curl -fsS "$B/comunas" | python3 -c 'import sys,json; d=json.load(sys.stdin)["comunas"]; print(next(x["id"] for x in d if x["name"]=="Doñihue"))')

echo "Catálogo: categoría=$CAT comuna=$COMUNA"

curl -fsS -c /tmp/pg_client.cookies -X POST "$B/auth/register" -H "$J" \
  -d "{\"name\":\"Cliente Beta Real\",\"email\":\"cliente.beta@datoya.test\",\"password\":\"Prueba123\",\"phone\":\"+56911110000\",\"role\":\"cliente\",\"comuna_id\":$COMUNA}" >/tmp/pg_client.json

grep -q '"ok":true' /tmp/pg_client.json

curl -fsS -c /tmp/pg_worker.cookies -X POST "$B/auth/register" -H "$J" \
  -d "{\"name\":\"Profesional Beta Real\",\"email\":\"profesional.beta@datoya.test\",\"password\":\"Prueba123\",\"phone\":\"+56922220000\",\"role\":\"trabajador\",\"comuna_id\":$COMUNA}" >/tmp/pg_worker.json

grep -q '"ok":true' /tmp/pg_worker.json

WORKER_ID=$(curl -fsS -b /tmp/pg_worker.cookies "$B/auth/me" | python3 -c 'import sys,json; print(json.load(sys.stdin)["user"]["worker"]["id"])')

PROFILE=$(curl -fsS -b /tmp/pg_worker.cookies -X PUT "$B/worker/profile" -H "$J" \
  -d "{\"oficio\":\"Gasfíter\",\"description\":\"Profesional beta real\",\"years_experience\":5,\"price_from\":20000,\"status\":\"disponible\",\"comuna_id\":$COMUNA,\"categories\":[$CAT],\"comunas\":[$COMUNA]}")
echo "$PROFILE" | grep -q '"ok":true'

echo "✅ Registro y perfil profesional reales"

REQ_HTTP=$(curl -sS -o /tmp/pg_request.json -w '%{http_code}' -b /tmp/pg_client.cookies -X POST "$B/requests" -H "$J" \
  -d "{\"category_id\":$CAT,\"title\":\"Cambio de llave beta PostgreSQL\",\"description\":\"Necesito cambiar una llave de agua\",\"comuna_id\":$COMUNA,\"address_detail\":\"Dirección privada de prueba\",\"urgency\":\"hoy\",\"budget\":32000}")
REQ_JSON=$(cat /tmp/pg_request.json)
if [ "$REQ_HTTP" != "200" ]; then echo "Publicar solicitud falló HTTP $REQ_HTTP: $REQ_JSON"; false; fi
echo "$REQ_JSON" | grep -q '"ok":true'
REQ=$(echo "$REQ_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

FEED=$(curl -fsS -b /tmp/pg_worker.cookies "$B/requests/feed")
echo "$FEED" | grep -q 'Cambio de llave beta PostgreSQL'

echo "✅ Solicitud real visible al profesional compatible"

QUOTE=$(curl -fsS -b /tmp/pg_worker.cookies -X POST "$B/quotes" -H "$J" \
  -d "{\"request_id\":$REQ,\"price\":32000,\"description\":\"Cambio completo de llave\",\"available_date\":\"2026-09-15\",\"duration_estimate\":\"1 hora\",\"materials_included\":true}")
echo "$QUOTE" | grep -q '"ok":true'

DETAIL=$(curl -fsS -b /tmp/pg_client.cookies "$B/requests/$REQ")
QID=$(echo "$DETAIL" | python3 -c 'import sys,json; q=json.load(sys.stdin)["quotes"]; print(q[0]["id"])')
CONV=$(curl -fsS -b /tmp/pg_client.cookies "$B/conversations" | python3 -c 'import sys,json; x=json.load(sys.stdin)["conversations"]; print(x[0]["id"])')

BLOCK=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/conversations/$CONV/messages" -H "$J" \
  -d '{"body":"Escríbeme al +56 9 8765 4321"}')
echo "$BLOCK" | grep -q '"blocked":true'

echo "✅ Cotización y chat anti-contacto reales"

ACCEPT=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/quotes/$QID/accept" -H "$J")
echo "$ACCEPT" | grep -q '"ok":true'
JOB=$(echo "$ACCEPT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["job_id"])')

COMM=$(curl -fsS -b /tmp/pg_client.cookies "$B/jobs" | python3 -c "import sys,json; d=json.load(sys.stdin)['jobs']; j=next(x for x in d if int(x['id'])==$JOB); print(j['commission_amount'])")
[ "$COMM" = "3200" ] || { echo "Comisión inesperada: $COMM"; exit 1; }

echo "✅ Aceptación y comisión 10% persistidas"

curl -fsS -b /tmp/pg_worker.cookies -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"CONFIRMADO"}' | grep -q '"ok":true'
curl -fsS -b /tmp/pg_worker.cookies -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"EN_PROCESO"}' | grep -q '"ok":true'

COMPLETE=$(curl -fsS -b /tmp/pg_worker.cookies -X POST "$B/jobs/$JOB/complete-request" -H "$J" -d '{}')
echo "$COMPLETE" | grep -q 'AWAITING_CONFIRMATION'

PROT=$(curl -fsS -b /tmp/pg_client.cookies "$B/jobs/$JOB/protection")
echo "$PROT" | grep -q 'AWAITING_CONFIRMATION'

FINAL=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"FINALIZADO"}')
echo "$FINAL" | grep -q '"ok":true'

RELEASED=$(curl -fsS -b /tmp/pg_client.cookies "$B/jobs/$JOB/protection")
echo "$RELEASED" | grep -q 'RELEASED'

echo "✅ Trabajo y Pago Protegido completados sobre PostgreSQL"

REVIEW=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/jobs/$JOB/review" -H "$J" \
  -d '{"rating":5,"quality":5,"punctuality":5,"treatment":5,"price_rating":5,"comment":"Excelente trabajo beta real"}')
echo "$REVIEW" | grep -q '"ok":true'

EARN=$(curl -fsS -b /tmp/pg_worker.cookies "$B/worker/earnings")
echo "$EARN" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert int(d["disponible"])==28800, d'

FAV=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/favorites/$WORKER_ID" -H "$J")
echo "$FAV" | grep -q '"favorite":true'

REPORT=$(curl -fsS -b /tmp/pg_client.cookies -X POST "$B/reports" -H "$J" \
  -d "{\"target_type\":\"trabajo\",\"target_id\":$JOB,\"reason\":\"incumplimiento\",\"details\":\"Denuncia de prueba beta real\"}")
echo "$REPORT" | grep -q '"ok":true'

echo "✅ Reseña, ganancias, favoritos y denuncia persistidos"
echo "DatoYa PostgreSQL E2E REAL: OK"
