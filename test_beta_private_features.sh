#!/usr/bin/env bash
set -euo pipefail
node --check beta_private_features_bootstrap.js
grep -q "beta_private_features_bootstrap" production_start.js
grep -q "CREATE TABLE IF NOT EXISTS market_alerts" beta_private_features_bootstrap.js
grep -q "app.post('/api/market/search-events',(req,res)" beta_private_features_bootstrap.js || { echo "La captura de búsquedas sigue exigiendo sesión"; exit 1; }
grep -q "__dyOptionalMarketUser" beta_private_features_bootstrap.js || { echo "Falta usuario opcional para búsquedas públicas"; exit 1; }
grep -q "__dySearchDedupe" beta_private_features_bootstrap.js || { echo "Falta deduplicación de búsquedas"; exit 1; }
grep -q "IMPULSO_PLAN_REQUIRED" beta_private_features_bootstrap.js
grep -q "requireRole('cliente')" beta_private_features_bootstrap.js
grep -q "Datos agregados y anónimos" beta_private_features_bootstrap.js
grep -q "__dyRunAlertMatching" beta_private_features_bootstrap.js
grep -q "__dyRunBusinessSignals" beta_private_features_bootstrap.js
grep -q "stock_low" beta_private_features_bootstrap.js
grep -q "impulse_expiring" beta_private_features_bootstrap.js
grep -q "order_cancelled" beta_private_features_bootstrap.js
if grep -q "b.logo_data" beta_private_features_bootstrap.js; then echo "Favorites consulta una columna inexistente en businesses"; exit 1; fi
grep -q "api/admin/private-beta" beta_private_features_bootstrap.js
grep -q "commerce/favorites/details" beta_private_features_bootstrap.js
! grep -q "DATOYA_ALLOW_LIVE_PAYMENTS.*true" beta_private_features_bootstrap.js
echo "Beta privada: validaciones estáticas correctas"
