#!/usr/bin/env bash
set -euo pipefail
node --check beta_private_features_bootstrap.js
grep -q "beta_private_features_bootstrap" production_start.js
grep -q "CREATE TABLE IF NOT EXISTS market_alerts" beta_private_features_bootstrap.js
grep -q "IMPULSO_PLAN_REQUIRED" beta_private_features_bootstrap.js
grep -q "requireRole('cliente')" beta_private_features_bootstrap.js
grep -q "Datos agregados y anónimos" beta_private_features_bootstrap.js
! grep -q "DATOYA_ALLOW_LIVE_PAYMENTS.*true" beta_private_features_bootstrap.js
echo "Beta privada: validaciones estáticas correctas"
