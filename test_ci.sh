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

# Validación rápida de sintaxis del frontend y módulos de UI añadidos en DatoYa 2.0.
for js in app.js gps_ui.js workflow_v2_ui.js gps_map_ui.js protection_ui.js evidence_ui.js request_photos_ui.js role_ui_fix.js admin_v2_ui.js worker_v2_ui.js; do
  if [ -f "$js" ] && ! node --check "$js"; then
    echo "Error de sintaxis en $js"
    exit 1
  fi
done

# Validación rápida de sintaxis de los módulos Node que componen el servidor.
for js in server.js db.js territory_start.js reports_bootstrap.js reports_routes.js request_photos_bootstrap.js evidence_bootstrap.js admin_v2_bootstrap.js protection_bootstrap.js; do
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
if ! curl -fsS http://localhost:3000/health | grep -q '"status":"healthy"'; then
  echo "Healthcheck DatoYa no está saludable"
  cat /tmp/datoya-ci.log
  exit 1
fi

echo "Healthcheck DatoYa OK"
bash test_e2e.sh
