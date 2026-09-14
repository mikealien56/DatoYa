#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
rm -f datoya.db datoya.db-shm datoya.db-wal

PORT=3101 DEMO_MODE=true MP_HYBRID_ENFORCE=0 npm start >/tmp/datoya-hybrid.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

B=http://localhost:3101/api
J='Content-Type: application/json'
for i in $(seq 1 90); do
  if curl -fsS "$B/categories" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then cat /tmp/datoya-hybrid.log; exit 1; fi
  sleep 1
  if [ "$i" = 90 ]; then cat /tmp/datoya-hybrid.log; exit 1; fi
done

curl -fsS -c /tmp/dy_h_cli -X POST "$B/auth/login" -H "$J" -d '{"email":"cliente@demo.cl","password":"demo1234"}' >/dev/null
curl -fsS -c /tmp/dy_h_worker -X POST "$B/auth/login" -H "$J" -d '{"email":"trabajador@demo.cl","password":"demo1234"}' >/dev/null

create_job(){
  local title="$1" duration="$2" price="$3"
  local r req qid accept
  r=$(curl -fsS -b /tmp/dy_h_cli -X POST "$B/requests" -H "$J" -d "{\"category_id\":1,\"title\":\"$title\",\"description\":\"Prueba de pago híbrido\",\"comuna_id\":4,\"urgency\":\"normal\",\"budget\":$price}")
  req=$(printf '%s' "$r" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
  curl -fsS -b /tmp/dy_h_worker -X POST "$B/quotes" -H "$J" -d "{\"request_id\":$req,\"price\":$price,\"description\":\"Cotización híbrida\",\"available_date\":\"2026-09-15\",\"duration_estimate\":\"$duration\",\"materials_included\":true}" >/dev/null
  qid=$(curl -fsS -b /tmp/dy_h_cli "$B/requests/$req" | python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
  accept=$(curl -fsS -b /tmp/dy_h_cli -X POST "$B/quotes/$qid/accept" -H "$J")
  printf '%s' "$accept" | python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])'
}

SHORT=$(create_job 'Híbrido corto' '2 horas' 40000)
FLOW=$(curl -fsS -b /tmp/dy_h_cli "$B/jobs/$SHORT/payment-flow")
printf '%s' "$FLOW" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["test_mode"] is True;assert d["real_money"] is False;assert d["flow"]["mode"]=="PREAUTH_SHORT";assert d["flow"]["state"]=="PREAUTH_REQUIRED"'

AUTH=$(curl -fsS -b /tmp/dy_h_cli -X POST "$B/jobs/$SHORT/payment-flow/authorize-test" -H "$J" -d '{}')
printf '%s' "$AUTH" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["flow"]["authorization_status"]=="AUTHORIZED_TEST";assert d["real_money"] is False'
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$SHORT/status" -H "$J" -d '{"status":"CONFIRMADO"}' >/dev/null
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$SHORT/status" -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$SHORT/complete-request" -H "$J" -d '{}' >/dev/null
FLOW=$(curl -fsS -b /tmp/dy_h_cli "$B/jobs/$SHORT/payment-flow")
printf '%s' "$FLOW" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["flow"]["state"]=="AWAITING_CLIENT_APPROVAL";assert d["flow"]["work_marked_done_at"]'
PAID=$(curl -fsS -b /tmp/dy_h_cli -X POST "$B/jobs/$SHORT/payment-flow/approve-test" -H "$J" -d '{}')
printf '%s' "$PAID" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["status"]=="FINALIZADO";assert d["flow"]["state"]=="PAID_TEST";assert d["breakdown"]["worker_amount"]==36000;assert d["real_money"] is False'

echo '✅ Trabajo corto: garantía TEST → revisión → captura TEST'

LONG=$(create_job 'Híbrido largo' '2 semanas' 60000)
FLOW=$(curl -fsS -b /tmp/dy_h_cli "$B/jobs/$LONG/payment-flow")
printf '%s' "$FLOW" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["flow"]["mode"]=="PAY_ON_COMPLETION";assert d["flow"]["state"]=="WORK_ALLOWED"'
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$LONG/status" -H "$J" -d '{"status":"CONFIRMADO"}' >/dev/null
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$LONG/status" -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
curl -fsS -b /tmp/dy_h_worker -X POST "$B/jobs/$LONG/complete-request" -H "$J" -d '{}' >/dev/null
FLOW=$(curl -fsS -b /tmp/dy_h_cli "$B/jobs/$LONG/payment-flow")
printf '%s' "$FLOW" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["flow"]["state"]=="AWAITING_PAYMENT"'
PAID=$(curl -fsS -b /tmp/dy_h_cli -X POST "$B/jobs/$LONG/payment-flow/approve-test" -H "$J" -d '{}')
printf '%s' "$PAID" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["flow"]["state"]=="PAID_TEST";assert d["breakdown"]["worker_amount"]==54000'

echo '✅ Trabajo largo: terminar → revisar → pagar TEST'

echo 'DatoYa pago híbrido TEST: OK'
