#!/bin/bash
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

rm -f datoya.db datoya.db-shm datoya.db-wal
if [ ! -d node_modules ]; then npm ci --silent; fi

node app_runtime_fix.js
node worker_demo_badge_runtime_fix.js

for js in app.js frontend_globals_bridge.js chat_ui_fix.js notifications_ui_fix.js worker_own_profile_ui.js worker_finance_ui.js gps_ui.js workflow_v2_ui.js gps_map_ui.js gps_map_ui_v2.js protection_ui.js evidence_ui.js review_ui.js reports_ui.js request_photos_ui.js request_detail_ui_fix.js role_ui_fix.js admin_v2_ui.js admin_core_ui_fix.js admin_operations_ui.js worker_v2_ui.js verification_admin_ui.js verification_worker_ui.js request_target_ui.js home_request_fix.js direct_worker_category_fix.js job_finish_guard_ui.js worker_profile_fix.js worker_portfolio_ui.js nearby_ui.js; do
  if [ -f "$js" ] && ! node --check "$js"; then echo "Error de sintaxis en $js"; exit 1; fi
done

for js in server.js db.js territory_start.js reports_bootstrap.js reports_routes.js reports_admin_fix.js request_photos_bootstrap.js evidence_schema.js evidence_bootstrap.js job_events_schema.js chat_workflow_bootstrap.js admin_v2_bootstrap.js admin_operations_bootstrap.js admin_case_bootstrap.js verification_bootstrap.js verification_review_bootstrap.js protection_schema.js protection_bootstrap.js protection_flow_guard.js protection_complete_fix.js workflow_guard_bootstrap.js review_status_bootstrap.js request_target_bootstrap.js gps_schema.js gps_bootstrap.js gps_syntax_fix.js nearby_workers_bootstrap.js nearby_location_schema.js demo_admin_seed.js demo_bootstrap.js demo_runtime_seed.js demo_compat_fix.js portfolio_runtime_fix.js app_runtime_fix.js worker_demo_badge_runtime_fix.js backend_runtime_fix.js; do
  if [ -f "$js" ] && ! node --check "$js"; then echo "Error de sintaxis en $js"; exit 1; fi
done

if grep -q 'demoTag(1)' app.js; then
  echo "El frontend sigue marcando a todos los profesionales como DEMO"; exit 1
fi
if ! grep -q 'routes.solicitud' request_detail_ui_fix.js || ! grep -q 'request-quote-form' request_detail_ui_fix.js; then
  echo "El detalle de solicitud no contiene el flujo de cotización usable"; exit 1
fi
if ! grep -q 'routes.ganancias' worker_finance_ui.js || ! grep -q 'activateDatoYaPro' worker_finance_ui.js; then
  echo "La UI de ganancias/PRO no contiene el flujo funcional esperado"; exit 1
fi
if ! grep -q 'review-status' review_status_bootstrap.js || ! grep -q 'data-review-submit' review_ui.js; then
  echo "El flujo visible de reseñas no está completo"; exit 1
fi
if ! grep -q "target_type:'trabajo'" reports_ui.js || ! grep -q 'data-report-form' reports_ui.js; then
  echo "El flujo visible de denuncias desde trabajos no está completo"; exit 1
fi

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

if ! curl -fsS http://localhost:3000/health | grep -q '"ok":true'; then
  echo "Healthcheck DatoYa no está saludable"; cat /tmp/datoya-ci.log; exit 1
fi
echo "Healthcheck DatoYa OK"

if ! grep -q 'DATOYA CHAT WORKFLOW GUARD V1' server.js; then
  echo "El guard de chat/cotizaciones no quedó montado en runtime"; cat /tmp/datoya-ci.log; exit 1
fi
if ! grep -q 'VERIFICACIÓN PROFESIONAL DATOYA 2.0' server.js; then
  echo "El flujo avanzado de verificación no quedó montado en runtime"; cat /tmp/datoya-ci.log; exit 1
fi
if ! grep -q 'DATOYA ADMIN OPERATIONS V1' server.js; then
  echo "Las operaciones administrativas no quedaron montadas en runtime"; cat /tmp/datoya-ci.log; exit 1
fi
if ! grep -q 'DATOYA REVIEW STATUS V1' server.js; then
  echo "El estado de reseñas no quedó montado en runtime"; cat /tmp/datoya-ci.log; exit 1
fi
echo "Runtime guards/operaciones OK"

node - <<'NODE'
const {db}=require('./db');
for (const t of ['job_travel_sessions','job_location_events','worker_locations','job_evidence','job_events','verification_history']) {
  const ok=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  if(!ok) { console.error('Falta tabla: '+t); process.exit(1); }
}
for (const k of ['gps_arrival_radius_m','gps_max_accuracy_m']) {
  const ok=db.prepare('SELECT value FROM settings WHERE key=?').get(k);
  if(!ok) { console.error('Falta configuración GPS: '+k); process.exit(1); }
}
console.log('GPS/evidencias/eventos/verificación schema OK');
NODE

GPS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/jobs/1/travel)
if [ "$GPS_STATUS" != "401" ]; then echo "Ruta GPS no protegida/montada correctamente (HTTP $GPS_STATUS)"; cat /tmp/datoya-ci.log; exit 1; fi
VERIFY_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/worker/verification-requests)
if [ "$VERIFY_STATUS" != "401" ]; then echo "Ruta avanzada de verificación no protegida/montada correctamente (HTTP $VERIFY_STATUS)"; cat /tmp/datoya-ci.log; exit 1; fi
EARNINGS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/worker/earnings)
if [ "$EARNINGS_STATUS" != "401" ]; then echo "Ruta de ganancias no protegida correctamente (HTTP $EARNINGS_STATUS)"; cat /tmp/datoya-ci.log; exit 1; fi
REVIEW_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/jobs/1/review-status)
if [ "$REVIEW_STATUS" != "401" ]; then echo "Ruta de estado de reseña no protegida correctamente (HTTP $REVIEW_STATUS)"; cat /tmp/datoya-ci.log; exit 1; fi

WORKERS_JSON=$(curl -fsS http://localhost:3000/api/workers)
if ! printf '%s' "$WORKERS_JSON" | grep -q '"is_demo"'; then
  echo "La API pública no informa qué perfiles son DEMO"; exit 1
fi

for asset in frontend_globals_bridge.js chat_ui_fix.js notifications_ui_fix.js request_detail_ui_fix.js worker_own_profile_ui.js worker_finance_ui.js review_ui.js reports_ui.js gps_ui.js nearby_ui.js datoya-logo.svg admin_v2_ui.js admin_core_ui_fix.js admin_operations_ui.js verification_admin_ui.js verification_worker_ui.js; do
  if ! curl -fsS "http://localhost:3000/$asset" >/dev/null; then echo "Archivo estático no publicado: $asset"; exit 1; fi
done
INDEX_HTML=$(curl -fsS http://localhost:3000/)
if ! printf '%s' "$INDEX_HTML" | grep -q '/frontend_globals_bridge.js'; then
  echo "El puente de estado frontend no está cargado en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/chat_ui_fix.js'; then
  echo "La interfaz estable del chat no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/notifications_ui_fix.js'; then
  echo "La bandeja funcional de notificaciones no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/request_detail_ui_fix.js'; then
  echo "El detalle real de solicitudes/cotizaciones no está cargado en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/worker_own_profile_ui.js'; then
  echo "El editor del perfil profesional no está cargado en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/worker_finance_ui.js'; then
  echo "La UI de ganancias/PRO del profesional no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/review_ui.js'; then
  echo "La UI de reseñas no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/reports_ui.js'; then
  echo "La UI de denuncias no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/admin_core_ui_fix.js'; then
  echo "La UI administrativa completa no está cargada en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/admin_operations_ui.js'; then
  echo "Las operaciones administrativas no están cargadas en index.html"; exit 1
fi
if ! printf '%s' "$INDEX_HTML" | grep -q '/datoya-logo.svg'; then
  echo "El logo de DatoYa no está referenciado en la página"; exit 1
fi
echo "Frontend/estáticos smoke test OK"

bash test_admin_smoke.sh
bash test_e2e.sh
