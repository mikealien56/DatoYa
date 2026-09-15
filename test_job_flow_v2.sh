#!/bin/bash
# Regresión DatoYa 2.0: crea usuarios temporales reales y prueba el ciclo oficial.
set -euo pipefail
B=${B:-http://localhost:3000/api}
J='Content-Type: application/json'
C=/tmp/dy_flow_client
W=/tmp/dy_flow_worker
rm -f "$C" "$W"
STAMP="$(date +%s)-$$"
CLIENT_EMAIL="ci-client-${STAMP}@test.datoya.local"
WORKER_EMAIL="ci-worker-${STAMP}@test.datoya.local"
PASS='DatoYaTest2026!'
register(){ local cookie="$1" name="$2" email="$3" role="$4"; curl -fsS -c "$cookie" -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASS\",\"role\":\"$role\",\"comuna_id\":4}" >/dev/null; }
register "$C" 'Cliente CI' "$CLIENT_EMAIL" cliente
register "$W" 'Profesional CI' "$WORKER_EMAIL" trabajador
# El profesional recién registrado debe quedar asociado a la categoría usada por la solicitud.
# Se usa la API propia del perfil; no se inyectan cuentas ni trabajos DEMO.
curl -fsS -b "$W" -X PUT "$B/worker/profile" -H "$J" -d '{"oficio":"Gasfíter CI","description":"Profesional temporal para pruebas automáticas","categories":[1],"comuna_id":4}' >/dev/null
R=$(curl -fsS -b "$C" -X POST "$B/requests" -H "$J" -d '{"category_id":1,"title":"Flujo protegido V2","description":"Prueba automática del ciclo oficial","comuna_id":4}')
REQ=$(echo "$R"|python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -fsS -b "$W" -X POST "$B/quotes" -H "$J" -d "{\"request_id\":$REQ,\"price\":25000,\"description\":\"Prueba flujo V2\"}" >/dev/null
Q=$(curl -fsS -b "$C" "$B/requests/$REQ"|python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
JOB=$(curl -fsS -b "$C" -X POST "$B/quotes/$Q/accept" -H "$J"|python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')
curl -fsS -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"CONFIRMADO"}' >/dev/null
curl -fsS -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
LEGACY=$(curl -sS -b "$C" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"FINALIZADO"}')
echo "$LEGACY"|grep -q 'Protección DatoYa'
A=$(curl -fsS -b "$W" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$A"|grep -q '"finalized":false'
Z=$(curl -fsS -b "$C" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$Z"|grep -q '"finalized":true'
STATUS=$(curl -fsS -b "$C" "$B/jobs"|python3 -c "import sys,json;print([j for j in json.load(sys.stdin)['jobs'] if j['id']==$JOB][0]['status'])")
test "$STATUS" = FINALIZADO
echo 'Canonical DatoYa 2.0 real-mode job lifecycle OK'
