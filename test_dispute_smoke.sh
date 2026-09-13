#!/bin/bash
set -euo pipefail
B=http://localhost:3000/api
J='Content-Type: application/json'
CLI=/tmp/dy_dispute_cli
TRA=/tmp/dy_dispute_tra
ADM=/tmp/dy_dispute_adm

curl -fsS -c "$CLI" -X POST "$B/auth/login" -H "$J" -d '{"email":"cliente@demo.cl","password":"demo1234"}' | grep -q '"ok":true'
curl -fsS -c "$TRA" -X POST "$B/auth/login" -H "$J" -d '{"email":"trabajador@demo.cl","password":"demo1234"}' | grep -q '"ok":true'
curl -fsS -c "$ADM" -X POST "$B/auth/login" -H "$J" -d '{"email":"admin@demo.cl","password":"demo1234"}' | grep -q '"ok":true'

make_job(){
  local title="$1" price="$2"
  local r req qid accepted
  r=$(curl -fsS -b "$CLI" -X POST "$B/requests" -H "$J" -d "{\"category_id\":1,\"title\":\"$title\",\"description\":\"Flujo de prueba protegido\",\"comuna_id\":4,\"urgency\":\"hoy\",\"budget\":$price}")
  req=$(printf '%s' "$r" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
  curl -fsS -b "$TRA" -X POST "$B/quotes" -H "$J" -d "{\"request_id\":$req,\"price\":$price,\"description\":\"Cotización prueba disputa\"}" | grep -q '"ok":true'
  qid=$(curl -fsS -b "$CLI" "$B/requests/$req" | python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
  accepted=$(curl -fsS -b "$CLI" -X POST "$B/quotes/$qid/accept" -H "$J")
  printf '%s' "$accepted" | python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])'
}

# 1) Cancelación temprana: solo antes de confirmar.
JOB_CANCEL=$(make_job 'Prueba cancelación temprana' 26000)
R=$(curl -fsS -b "$CLI" -X POST "$B/jobs/$JOB_CANCEL/cancel" -H "$J" -d '{"reason":"Cliente ya no requiere el servicio"}')
printf '%s' "$R" | grep -q '"status":"CANCELADO"'
printf '%s' "$R" | grep -q '"status":"REFUNDED"'
if curl -s -b "$TRA" -X POST "$B/jobs/$JOB_CANCEL/status" -H "$J" -d '{"status":"CONFIRMADO"}' | grep -q '"ok":true'; then
  echo 'La cancelación temprana permitió confirmar un trabajo cancelado'; exit 1
fi
echo 'Cancelación temprana protegida OK'

# 2) Disputa → corrección → segunda revisión → liberación por cliente.
JOB_FIX=$(make_job 'Prueba corrección protegida' 33000)
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_FIX/status" -H "$J" -d '{"status":"CONFIRMADO"}' | grep -q '"ok":true'
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_FIX/status" -H "$J" -d '{"status":"EN_PROCESO"}' | grep -q '"ok":true'
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_FIX/complete-request" -H "$J" -d '{}' | grep -q 'AWAITING_CONFIRMATION'
curl -fsS -b "$CLI" -X POST "$B/jobs/$JOB_FIX/dispute/open" -H "$J" -d '{"reason":"La reparación necesita una corrección"}' | grep -q '"status":"DISPUTA"'
curl -fsS -b "$ADM" -X POST "$B/admin/jobs/$JOB_FIX/dispute/review" -H "$J" -d '{"note":"Se revisan evidencias y conversación"}' | grep -q 'UNDER_REVIEW'
curl -fsS -b "$ADM" -X POST "$B/admin/jobs/$JOB_FIX/dispute/resolve" -H "$J" -d '{"action":"correction","resolution":"Corregir terminación y volver a documentar"}' | grep -q 'CORRECTION_REQUIRED'
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_FIX/correction/complete" -H "$J" -d '{"note":"Corrección realizada y revisada"}' | grep -q 'AWAITING_REVIEW'
curl -fsS -b "$CLI" "$B/jobs/$JOB_FIX/protection" | grep -q 'AWAITING_CONFIRMATION'
curl -fsS -b "$CLI" -X POST "$B/jobs/$JOB_FIX/status" -H "$J" -d '{"status":"FINALIZADO"}' | grep -q '"status":"FINALIZADO"'
curl -fsS -b "$CLI" "$B/jobs/$JOB_FIX/protection" | grep -q 'RELEASED'
echo 'Disputa con corrección y segunda revisión OK'

# 3) Disputa → devolución completa por resolución administrativa.
JOB_REFUND=$(make_job 'Prueba devolución protegida' 41000)
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_REFUND/status" -H "$J" -d '{"status":"CONFIRMADO"}' | grep -q '"ok":true'
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_REFUND/status" -H "$J" -d '{"status":"EN_PROCESO"}' | grep -q '"ok":true'
curl -fsS -b "$TRA" -X POST "$B/jobs/$JOB_REFUND/complete-request" -H "$J" -d '{}' | grep -q 'AWAITING_CONFIRMATION'
curl -fsS -b "$CLI" -X POST "$B/jobs/$JOB_REFUND/dispute/open" -H "$J" -d '{"reason":"Servicio no conforme"}' | grep -q '"status":"DISPUTA"'
curl -fsS -b "$ADM" -X POST "$B/admin/jobs/$JOB_REFUND/dispute/resolve" -H "$J" -d '{"action":"refund","resolution":"Devolución completa al cliente en modo DEMO"}' | grep -q '"status":"REFUNDED"'
curl -fsS -b "$CLI" "$B/jobs/$JOB_REFUND/protection" | grep -q 'REFUNDED'
JOB_STATUS=$(curl -fsS -b "$CLI" "$B/jobs" | python3 -c "import sys,json;d=json.load(sys.stdin)['jobs'];print([x for x in d if x['id']==$JOB_REFUND][0]['status'])")
[ "$JOB_STATUS" = 'CANCELADO' ] || { echo "Estado final inesperado tras devolución: $JOB_STATUS"; exit 1; }
echo 'Disputa con devolución completa OK'

echo 'Dispute/cancellation smoke OK'
