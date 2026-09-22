#!/usr/bin/env bash
set -euo pipefail
node --check beta_private_features_bootstrap.js
grep -q "beta_private_features_bootstrap" production_start.js
grep -q "CREATE TABLE IF NOT EXISTS market_alerts" beta_private_features_bootstrap.js
grep -q "CREATE TABLE IF NOT EXISTS market_alert_matches" beta_private_features_bootstrap.js || { echo "Falta historial de coincidencias de DatoYa Alerta"; exit 1; }
grep -q "__dyAlertKm" beta_private_features_bootstrap.js || { echo "DatoYa Alerta no valida radio por distancia"; exit 1; }
grep -q "'impulse_now' source_type" beta_private_features_bootstrap.js || { echo "DatoYa Alerta no considera Impulso Ahora"; exit 1; }
grep -q "'weekly' source_type" beta_private_features_bootstrap.js || { echo "DatoYa Alerta no considera Impulso semanal"; exit 1; }
grep -q "CAST(w.updated_at AS TEXT)" beta_private_features_bootstrap.js || { echo "DatoYa Alerta semanal mezcla tipos de fecha en PostgreSQL"; exit 1; }
grep -q "'promotion' ELSE 'product'" beta_private_features_bootstrap.js || { echo "DatoYa Alerta no distingue promociones"; exit 1; }
grep -q "impulse_priority" beta_private_features_bootstrap.js || { echo "Falta prioridad Impulso en DatoYa Alerta"; exit 1; }
grep -q "app.post('/api/market/search-events',(req,res)" beta_private_features_bootstrap.js || { echo "La captura de búsquedas sigue exigiendo sesión"; exit 1; }
grep -q "__dyOptionalMarketUser" beta_private_features_bootstrap.js || { echo "Falta usuario opcional para búsquedas públicas"; exit 1; }
grep -q "__dySearchDedupe" beta_private_features_bootstrap.js || { echo "Falta deduplicación de búsquedas"; exit 1; }
grep -q "IMPULSO_PLAN_REQUIRED" beta_private_features_bootstrap.js
grep -q "requireRole('cliente')" beta_private_features_bootstrap.js
grep -q "businesses/:id/wanted" beta_private_features_bootstrap.js || { echo "Falta bandeja Lo Busco Ya para negocios"; exit 1; }
grep -q "wanted_response" beta_private_features_bootstrap.js || { echo "Falta notificación de respuesta Lo Busco Ya"; exit 1; }
grep -q "business_category_links" beta_private_features_bootstrap.js || { echo "Lo Busco Ya no filtra por categoría del negocio"; exit 1; }
grep -q "Tu negocio debe estar activo para responder" beta_private_features_bootstrap.js || { echo "Falta guard de negocio activo en Lo Busco Ya"; exit 1; }
grep -q "Datos agregados y anónimos" beta_private_features_bootstrap.js
grep -q "__dyRunAlertMatching" beta_private_features_bootstrap.js
grep -q "__dyRunBusinessSignals" beta_private_features_bootstrap.js
grep -q "stock_low" beta_private_features_bootstrap.js
grep -q "impulse_expiring" beta_private_features_bootstrap.js
grep -q "order_cancelled" beta_private_features_bootstrap.js
if grep -q "b.logo_data" beta_private_features_bootstrap.js; then echo "Favorites consulta una columna inexistente en businesses"; exit 1; fi
grep -q "api/admin/private-beta" beta_private_features_bootstrap.js
grep -q "commerce/favorites/details" beta_private_features_bootstrap.js
grep -q "__dyRequireCustomerAccount" beta_private_features_bootstrap.js || { echo "Favoritos no validan account_type Cliente"; exit 1; }
grep -q "follow/notifications" beta_private_features_bootstrap.js || { echo "Falta control de avisos de negocios seguidos"; exit 1; }
grep -q "followed_promotion" beta_private_features_bootstrap.js || { echo "Falta notificación de promoción de negocio seguido"; exit 1; }
grep -q "followed_impulse" beta_private_features_bootstrap.js || { echo "Falta notificación de Impulso de negocio seguido"; exit 1; }
! grep -q "DATOYA_ALLOW_LIVE_PAYMENTS.*true" beta_private_features_bootstrap.js
echo "Beta privada: validaciones estáticas correctas"
