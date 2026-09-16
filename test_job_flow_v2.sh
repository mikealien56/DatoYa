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
req(){ local label="$1"; shift; local body code; body=$(mktemp); code=$(curl -sS -o "$body" -w '%{http_code}' "$@") || { echo "CI HTTP error: $label" >&2; cat "$body" >&2; rm -f "$body"; return 1; }; if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then echo "CI HTTP $code: $label" >&2; cat "$body" >&2; rm -f "$body"; return 1; fi; cat "$body"; rm -f "$body"; }
register(){ local cookie="$1" name="$2" email="$3" role="$4" phone="$5"; req "register $role" -c "$cookie" -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASS\",\"phone\":\"$phone\",\"role\":\"$role\",\"comuna_id\":4}" >/dev/null; }
verify_email(){ local cookie="$1" r token; r=$(req 'email verification request' -b "$cookie" -X POST "$B/auth/email-verification/request" -H "$J" -d '{}'); token=$(echo "$r"|python3 -c 'import sys,json;d=json.load(sys.stdin);assert d.get("test_token"),d;print(d["test_token"])'); req 'email verification confirm' -X POST "$B/auth/email-verification/confirm" -H "$J" -d "{\"token\":\"$token\"}"|grep -q '"ok":true'; }
echo 'Canonical flow: register users'
register "$C" 'Cliente CI' "$CLIENT_EMAIL" cliente '+56911111111'
register "$W" 'Profesional CI' "$WORKER_EMAIL" trabajador '+56922222222'
echo 'Canonical flow: verify emails'
verify_email "$C"
verify_email "$W"
echo 'Canonical flow: configure worker'
req 'worker profile' -b "$W" -X PUT "$B/worker/profile" -H "$J" -d '{"oficio":"Profesional CI","description":"Profesional temporal para pruebas automáticas","comuna_id":4}' >/dev/null
CAT=$(req 'worker specialties catalog' -b "$W" "$B/worker/specialties" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d.get("categories"),d;print(d["categories"][0]["id"])')
req 'save worker specialty' -b "$W" -X POST "$B/worker/specialties" -H "$J" -d "{\"category_ids\":[$CAT],\"primary_category_id\":$CAT}" >/dev/null
echo 'Canonical flow: create request and quote'
R=$(req 'create request' -b "$C" -X POST "$B/requests" -H "$J" -d "{\"category_id\":$CAT,\"title\":\"Flujo protegido V2\",\"description\":\"Prueba automática del ciclo oficial\",\"comuna_id\":4}")
REQ=$(echo "$R"|python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
req 'create quote' -b "$W" -X POST "$B/quotes" -H "$J" -d "{\"request_id\":$REQ,\"price\":25000,\"description\":\"Prueba flujo V2\",\"quote_type\":\"estimacion\",\"materials_treatment\":\"por_determinar\"}" >/dev/null
Q=$(req 'request detail' -b "$C" "$B/requests/$REQ"|python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
JOB=$(req 'accept quote' -b "$C" -X POST "$B/quotes/$Q/accept" -H "$J"|python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')
echo 'Canonical flow: run and complete job'
req 'confirm job' -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"CONFIRMADO"}' >/dev/null
req 'start job' -b "$W" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
echo 'Canonical flow: propose, reject and accept additional work'
M1=$(req 'propose rejected modification' -b "$W" -X POST "$B/jobs/$JOB/modifications" -H "$J" -d '{"reason":"Hallazgo al revisar","description":"Trabajo adicional no contemplado","additional_amount":3000,"materials_treatment":"no_incluidos"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
req 'reject modification' -b "$C" -X POST "$B/jobs/$JOB/modifications/$M1/decision" -H "$J" -d '{"decision":"rechazada"}' | grep -q '"current_amount":25000'
M2=$(req 'propose accepted modification' -b "$W" -X POST "$B/jobs/$JOB/modifications" -H "$J" -d '{"reason":"Hallazgo al revisar","description":"Segundo trabajo adicional documentado","additional_amount":5000,"materials_treatment":"incluidos"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
req 'accept modification' -b "$C" -X POST "$B/jobs/$JOB/modifications/$M2/decision" -H "$J" -d '{"decision":"aceptada"}' | grep -q '"current_amount":30000'
RECORD=$(req 'job record' -b "$C" "$B/jobs/$JOB/record")
echo "$RECORD" | grep -q '"quote_type":"estimacion"'
echo "$RECORD" | grep -q '"verified_by_datoya":false'
echo "$RECORD" | grep -q '"price":30000'
LEGACY=$(curl -sS -b "$C" -X POST "$B/jobs/$JOB/status" -H "$J" -d '{"status":"FINALIZADO"}')
echo "$LEGACY"|grep -Eq 'Respaldo DatoYa|Protección DatoYa|confirmación de ambas partes|aún no ha declarado terminado'
A=$(req 'worker completion' -b "$W" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$A"|grep -q '"finalized":false'
Z=$(req 'client completion' -b "$C" -X POST "$B/jobs/$JOB/complete-confirm" -H "$J" -d '{}')
echo "$Z"|grep -q '"finalized":true'
STATUS=$(req 'jobs list' -b "$C" "$B/jobs"|python3 -c "import sys,json;print([j for j in json.load(sys.stdin)['jobs'] if j['id']==$JOB][0]['status'])")
test "$STATUS" = FINALIZADO
echo 'Canonical DatoYa 2.0 real-mode job lifecycle OK'
