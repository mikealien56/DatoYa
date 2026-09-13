#!/bin/bash
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# CI starts from a clean workspace. Remove any prior SQLite files so tests are deterministic.
rm -f datoya.db datoya.db-shm datoya.db-wal

# GitHub Actions already installs dependencies with npm ci. Only install locally
# when this script is executed outside the workflow with no node_modules folder.
if [ ! -d node_modules ]; then
  npm ci --silent
fi

# Aplicar las mismas reparaciones previas que usa el arranque de producción.
node app_runtime_fix.js

# Validación rápida de sintaxis del frontend y módulos de UI añadidos en DatoYa 2.0.
for js in app.js gps_ui.js workflow_v2_ui.js gps_map_ui.js gps_map_ui_v2.js protection_ui.js evidence_ui.js request_photos_ui.js role_ui_fix.js admin_v2_ui.js worker_v2_ui.js verification_admin_ui.js verification_worker_ui.js request_target_ui.js home_request_fix.js direct_worker_category_fix.js job_finish_guard_ui.js worker_profile_fix.js worker_portfolio_ui.js; do
  if [ -f "$js" ] && ! node --check "$js"; then
    echo "Error de sintaxis en $js"
    exit 1
  fi
done

# Validación rápida de sintaxis de TODOS los módulos Node que el arranque de producción carga.
for js in server.js db.js territory_start.js reports_bootstrap.js reports_routes.js reports_admin_fix.js request_photos_bootstrap.js evidence_bootstrap.js chat_workflow_bootstrap.js admin_v2_bootstrap.js verification_bootstrap.js verification_review_bootstrap.js protection_schema.js protection_bootstrap.js protection_flow_guard.js protection_complete_fix.js workflow_guard_bootstrap.js request_target_bootstrap.js gps_schema.js gps_bootstrap.js gps_syntax_fix.js demo_admin_seed.js demo_runtime_seed.js demo_compat_fix.js portfolio_runtime_fix.js app_runtime_fix.js; do
  if [ -f "$js" ] && ! node --check "$js"; then
    echo "Error de sintaxis en $js"
    exit 1
  fi
done

npm start >/tmp/datoya-ci.log 2>&1 &
PID=$!
cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
  wait "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# DatoYa ejecuta el seed DEMO antes de abrir el listener. En runners limpios
# SQLite puede tardar más de 30 s, por lo que damos un margen razonable.
START_TIMEOUT=120
READY=0
for i in $(seq 1 "$START_TIMEOUT"); do
  if curl -fsS http://localhost:3000/api/categories >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "Servidor DatoYa no pudo iniciar"
    cat /tmp/datoya-ci.log
    exit 1
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Timeout esperando DatoYa después de ${START_TIMEOUT}s"
  cat /tmp/datoya-ci.log
  exit 1
fi

# Healthcheck de producción: valida que el proceso web y SQLite estén operativos.
if ! curl -fsS http://localhost:3000/health | grep -q '\"status\":\"healthy\"'; then
  echo "Healthcheck DatoYa no está saludable"
  cat /tmp/datoya-ci.log
  exit 1
fi

echo "Healthcheck DatoYa OK"

# Smoke test GPS: las tablas/configuración deben existir y las rutas deben estar
# montadas (sin sesión deben responder 401, no 404). También comprobamos que la
# UI GPS se publique realmente desde el servidor estático.
node - <<'NODE'
const {db}=require('./db');
for (const t of ['job_travel_sessions','job_location_events']) {
  const ok=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  if(!ok) { console.error('Falta tabla GPS: '+t); process.exit(1); }
}
for (const k of ['gps_arrival_radius_m','gps_max_accuracy_m']) {
  const ok=db.prepare('SELECT value FROM settings WHERE key=?').get(k);
  if(!ok) { console.error('Falta configuración GPS: '+k); process.exit(1); }
}
console.log('GPS schema/config OK');
NODE

GPS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/jobs/1/travel)
if [ "$GPS_STATUS" != "401" ]; then
  echo "Ruta GPS /api/jobs/:id/travel no está protegida/montada correctamente (HTTP $GPS_STATUS)"
  cat /tmp/datoya-ci.log
  exit 1
fi

if ! curl -fsS http://localhost:3000/gps_ui.js >/dev/null; then
  echo "UI GPS no publicada"
  exit 1
fi

echo "GPS smoke test OK"

bash test_e2e.sh
