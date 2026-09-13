#!/bin/bash
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

rm -f datoya.db datoya.db-shm datoya.db-wal
if [ ! -d node_modules ]; then npm ci --silent; fi

node app_runtime_fix.js

for js in app.js gps_ui.js workflow_v2_ui.js gps_map_ui.js gps_map_ui_v2.js protection_ui.js evidence_ui.js request_photos_ui.js role_ui_fix.js admin_v2_ui.js worker_v2_ui.js verification_admin_ui.js verification_worker_ui.js request_target_ui.js home_request_fix.js direct_worker_category_fix.js job_finish_guard_ui.js worker_profile_fix.js worker_portfolio_ui.js nearby_ui.js; do
  if [ -f "$js" ] && ! node --check "$js"; then echo "Error de sintaxis en $js"; exit 1; fi
done

for js in server.js db.js territory_start.js reports_bootstrap.js reports_routes.js reports_admin_fix.js request_photos_bootstrap.js evidence_schema.js evidence_bootstrap.js job_events_schema.js chat_workflow_bootstrap.js admin_v2_bootstrap.js admin_case_bootstrap.js verification_bootstrap.js verification_review_bootstrap.js protection_schema.js protection_bootstrap.js protection_flow_guard.js protection_complete_fix.js workflow_guard_bootstrap.js request_target_bootstrap.js gps_schema.js gps_bootstrap.js gps_syntax_fix.js nearby_workers_bootstrap.js nearby_location_schema.js demo_admin_seed.js demo_bootstrap.js demo_runtime_seed.js demo_compat_fix.js portfolio_runtime_fix.js app_runtime_fix.js; do
  if [ -f "$js" ] && ! node --check "$js"; then echo "Error de sintaxis en $js"; exit 1; fi
done

npm start >/tmp/datoya-ci.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1 || true; wait "$PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

START_TIMEOUT=120
READY=0
for i in $(seq 1 "$START_TIMEOUT"); do
  if curl -fsS http://localhost:3000/api/categories >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then echo "Servidor DatoYa no pudo iniciar"; cat /tmp/datoya-ci.log; exit 1; fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then echo "Timeout esperando DatoYa después de ${START_TIMEOUT}s"; cat /tmp/datoya-ci.log; exit 1; fi

if ! curl -fsS http://localhost:3000/health | grep -q '\"ok\":true'; then
  echo "Healthcheck DatoYa no está saludable"; cat /tmp/datoya-ci.log; exit 1
fi
echo "Healthcheck DatoYa OK"

node - <<'NODE'
const {db}=require('./db');
for (const t of ['job_travel_sessions','job_location_events','worker_locations','job_evidence','job_events']) {
  const ok=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  if(!ok) { console.error('Falta tabla: '+t); process.exit(1); }
}
for (const k of ['gps_arrival_radius_m','gps_max_accuracy_m']) {
  const ok=db.prepare('SELECT value FROM settings WHERE key=?').get(k);
  if(!ok) { console.error('Falta configuración GPS: '+k); process.exit(1); }
}
console.log('GPS/evidencias/eventos schema OK');
NODE

GPS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/jobs/1/travel)
if [ "$GPS_STATUS" != "401" ]; then echo "Ruta GPS no protegida/montada correctamente (HTTP $GPS_STATUS)"; cat /tmp/datoya-ci.log; exit 1; fi
for asset in gps_ui.js nearby_ui.js datoya-logo.svg admin_v2_ui.js; do
  if ! curl -fsS "http://localhost:3000/$asset" >/dev/null; then echo "Archivo estático no publicado: $asset"; exit 1; fi
done
echo "GPS/estáticos smoke test OK"

bash test_admin_smoke.sh
bash test_e2e.sh
