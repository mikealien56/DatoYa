#!/bin/bash
# Regresión DatoYa 2.0: el endpoint legacy no puede saltarse Protección DatoYa.
set -e
B=${B:-http://localhost:3000/api}
J='Content-Type: application/json'
C=/tmp/dy_flow_client
W=/tmp/dy_flow_worker
rm -f "$C" "$W"
curl -fsS -c "$C" -X POST "$B/auth/login" -H "$J" -d '{"email":"cliente@demo.cl","password":"demo1234"}' >/dev/null
curl -fsS -c "$W" -X POST "$B/auth/login" -H "$J" -d '{"email":"trabajador@demo.cl","password":"demo1234"}' >/dev/null
R=$(curl -fsS -b "$C" -X POST "$B/requests" -H "$J" -d '{"category_id":1,"title":"Flujo protegido V2","description":"Prueba automática del ciclo oficial","comuna_id":4}')
REQ=$(echo "$R"|python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -fsS -b "$W" -X POST "$B/quotes" -H "$J" -d "{\"request_id\":$REQ,\"price\":25000,\"description\":\"Prueba flujo V2\"}" >/dev/null
Q=$(curl -fsS -b "$C" "$B/requests/$REQ"|python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
JOB=$(curl -fsS -b "$C" -X POST "$B/quotes/$Q/accept" -H "$J"|python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')
curl -fsS -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"CONFIRMADO"}' >/dev/null
curl -fsS -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
LEGACY=$(curl -s -b "$C" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"FINALIZADO"}')
echo "$LEGACY"|grep -q 'Protección DatoYa'
A=$(curl -fsS -b "$W" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$A"|grep -q '"finalized":false'
Z=$(curl -fsS -b "$C" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$Z"|grep -q '"finalized":true'
STATUS=$(curl -fsS -b "$C" "$B/jobs"|python3 -c "import sys,json;print([j for j in json.load(sys.stdin)['jobs'] if j['id']==$JOB][0]['status'])")
test "$STATUS" = FINALIZADO
echo 'Canonical DatoYa 2.0 job lifecycle OK'