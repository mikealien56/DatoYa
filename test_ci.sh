#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== DatoYa CI base: marketplace comercial ==="
npm audit --omit=dev --audit-level=high
echo "✅ Dependencias de producción sin vulnerabilidades altas/críticas"
grep -q "legal_consent_recorded" account_security_bootstrap.js || { echo "Registro no persiste consentimiento legal"; exit 1; }
grep -q "LEGAL_ENFORCEMENT || 'true'" account_security_bootstrap.js || { echo "Enforcement legal no queda activo por defecto"; exit 1; }
echo "✅ Consentimiento legal integrado al registro"
grep -q "current_legal_consent_enforcement_bootstrap" production_start.js || { echo "Guard de consentimiento vigente no montado"; exit 1; }
grep -q "LEGAL_CONSENT_REQUIRED" app.js || { echo "Frontend no maneja reaceptación legal"; exit 1; }
echo "✅ Reaceptación de versión legal vigente protegida"
bash test_beta_private_ui.sh
bash test_mobile_account_role.sh
bash test_mobile_notifications.sh
bash test_mp_test_redirect.sh
bash test_beta_private_features.sh
bash test_pwa_security.sh
node --check push_notifications_bootstrap.js
grep -q '"web-push"' package.json || { echo "Falta dependencia web-push"; exit 1; }
grep -q "CREATE TABLE IF NOT EXISTS push_subscriptions" push_notifications_bootstrap.js || { echo "Falta persistencia de suscripciones Push"; exit 1; }
grep -q "app.get('/api/push/config'" push_notifications_bootstrap.js || { echo "Falta configuración pública autenticada de Push"; exit 1; }
grep -q "app.post('/api/push/subscribe'" push_notifications_bootstrap.js || { echo "Falta alta de suscripción Push"; exit 1; }
grep -q "__datoyaPushNotify" db.js || { echo "SQLite no conecta notificaciones con Push"; exit 1; }
grep -q "__datoyaPushNotify" db_pg.js || { echo "PostgreSQL no conecta notificaciones con Push"; exit 1; }

# 1) Sintaxis de todo el runtime actual.
for js in *.js; do
  node --check "$js" >/dev/null || { echo "Error de sintaxis en $js"; exit 1; }
done
node --check scripts/migrate_render_to_neon.js >/dev/null
node test_postgres_connection.js
grep -q "CREATE TABLE IF NOT EXISTS market_categories" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS businesses" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS business_category_links" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS market_account_types" postgres/002_market_account_types.sql
grep -q "ON CONFLICT (user_id) DO NOTHING" postgres/002_market_account_types.sql
grep -q "Falta tabla PostgreSQL: market_account_types" postgres_migrate.js
grep -q "CREATE TABLE IF NOT EXISTS support_cases" postgres/003_support_cases.sql
grep -q "Falta tabla PostgreSQL: support_cases" postgres_migrate.js
grep -q "ADD COLUMN IF NOT EXISTS business_id" postgres/006_business_support_threads.sql
grep -q "CREATE TABLE IF NOT EXISTS support_case_messages" postgres/006_business_support_threads.sql
grep -q "Falta tabla PostgreSQL: support_case_messages" postgres_migrate.js
grep -q "CREATE TABLE IF NOT EXISTS business_impulse_memberships" postgres/004_marketplace_admin_v2.sql
grep -q "CREATE TABLE IF NOT EXISTS business_impulse_payments" postgres/004_marketplace_admin_v2.sql
grep -q "impulso_quarterly_price" postgres/005_impulso_quarterly_pricing.sql
grep -q "quarterly" marketplace_admin_v2_bootstrap.js
grep -q "26990" marketplace_admin_v2_bootstrap.js
grep -q "89990" marketplace_admin_v2_bootstrap.js
grep -q "impulso_free_catalog_limit','20" marketplace_admin_v2_bootstrap.js
grep -q "impulso_paid_catalog_limit','200" marketplace_admin_v2_bootstrap.js
grep -q "Falta tabla PostgreSQL: business_impulse_memberships" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: business_impulse_payments" postgres_migrate.js
echo "✅ Migrador PostgreSQL a Neon"
echo "✅ Sintaxis JavaScript"

bash -n scripts/backup_postgres.sh scripts/verify_postgres_restore.sh
test -s RECOVERY_RUNBOOK.md
echo "✅ Scripts de backup/restauración"

# 2) El Home debe arrancar por la capa comercial, no por trabajadores.
grep -q "__datoyaRenderMarketHome" app.js || { echo "app.js no delega el Home al marketplace"; exit 1; }
grep -q "__datoyaRenderMarketHome=renderMarketShell" local_market_home.js || { echo "El shell comercial no está montado"; exit 1; }
grep -q "dy-market-boot-shield" local_market_home_assets.js || { echo "Falta protección visual del arranque comercial"; exit 1; }
grep -q "marketplace_legacy_route_guard" marketplace_public_shell_assets.js || { echo "Falta guard de rutas legacy"; exit 1; }
echo "✅ Arranque comercial protegido"

# 3) Territorio / GPS.
node test_territory_location.js
echo "✅ Resolución territorial"

# 4) Base SQLite limpia para pruebas de runtime.
rm -f datoya.db datoya.db-shm datoya.db-wal
if [ ! -d node_modules ]; then npm ci --silent; fi

# La verificación de correo usa tokens solo dentro de CI.
export AUTH_TEST_MODE=true
export DEMO_MODE=false
export ADMIN_EMAIL="admin-ci@datoya.invalid"
export ADMIN_PASSWORD="DatoYa-CI-Admin-2026"
export PORT=3000

npm start >/tmp/datoya-ci.log 2>&1 &
PID=$!
cleanup(){ kill "$PID" >/dev/null 2>&1||true; wait "$PID" >/dev/null 2>&1||true; }
trap cleanup EXIT

READY=0
for i in $(seq 1 120); do
  if curl -fsS http://localhost:3000/api/market/categories >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "Servidor DatoYa no pudo iniciar"; cat /tmp/datoya-ci.log; exit 1
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then echo "Timeout esperando DatoYa"; cat /tmp/datoya-ci.log; exit 1; fi

curl -fsS http://localhost:3000/health | grep -q '"ok":true'
CATS=$(curl -fsS http://localhost:3000/api/market/categories | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["categories"]))')
[ "$CATS" -ge 20 ] || { echo "Catálogo comercial incompleto: $CATS"; exit 1; }
curl -fsS http://localhost:3000/api/market/categories | python3 -c 'import sys,json; c=json.load(sys.stdin)["categories"]; o=next((x for x in c if x["slug"]=="opticas"),None); assert o and o["name"]=="Ópticas" and o["icon"]=="👓"' || { echo "Falta categoría Ópticas"; exit 1; }
echo "✅ Healthcheck + categorías comerciales"

# 5) Rutas privadas del marketplace no deben abrir sin sesión.
for path in businesses/mine businesses/1/support-cases businesses/1/plan-access orders/mine admin/support-cases admin/marketplace-v2/summary push/config; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/$path")
  [ "$code" = "401" ] || { echo "Ruta privada incorrecta /api/$path HTTP $code"; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/admin/marketplace/businesses")
[ "$code" = "401" ] || { echo "Admin marketplace no está protegido HTTP $code"; exit 1; }
echo "✅ Autorización base"

# Centro de soporte público: debe validar datos antes de intentar enviar correo.
SUPPORT_CODE=$(curl -s -o /tmp/dy_support_invalid.json -w '%{http_code}' -X POST "http://localhost:3000/api/support/contact" -H 'Content-Type: application/json' -d '{"name":"Prueba","email":"correo-invalido","subject":"Ayuda","message":"Necesito ayuda con DatoYa"}')
[ "$SUPPORT_CODE" = "400" ] || { echo "Validación soporte incorrecta HTTP $SUPPORT_CODE"; cat /tmp/dy_support_invalid.json; exit 1; }
echo "✅ Centro de soporte montado y validando"

# 6) Assets que definen la beta comercial.
for asset in   manifest.webmanifest service-worker.js local_market_home.js marketplace_account_ui.js marketplace_public_beta_ui.js   marketplace_business_ui.js marketplace_commerce_ui.js marketplace_payments_ui.js   marketplace_growth_ui.js marketplace_hours_ui.js marketplace_guided_demo_ui.js marketplace_delivery_ui.js marketplace_promo_analytics_ui.js marketplace_integrations_ui.js support_center_ui.js business_support_ui.js support_center.css admin_support_cases_ui.js marketplace_admin_v2_ui.js business_hub_ui.js business_hub.css marketplace_admin_v2.css business_impulse_plan_ui.js business_impulse_plan.css   marketplace_demo_showcase_ui.js marketplace_demo_pitch_ui.js marketplace_legacy_route_guard.js   marketplace_growth.css marketplace_hours.css marketplace_guided_demo.css marketplace_delivery.css marketplace_promo_analytics.css marketplace_integrations.css   brand/datoya-logo-horizontal.png; do
  curl -fsS "http://localhost:3000/$asset" >/dev/null || { echo "Archivo estático no publicado: $asset"; exit 1; }
done
grep -q "Cuenta administrador" marketplace_account_ui.js || { echo "Mi DatoYa no distingue la cuenta administradora"; exit 1; }
grep -q "href=\"#/admin\"" marketplace_account_ui.js || { echo "Mi DatoYa admin no enlaza al panel administrativo"; exit 1; }
grep -q 'dy-pwa-register' public/index.html || { echo "Falta registro del Service Worker PWA"; exit 1; }
grep -q 'serviceWorker.register("/service-worker.js"' public/index.html || { echo "Registro PWA no apunta al Service Worker de DatoYa"; exit 1; }
grep -q 'mi-negocio-pagos' marketplace_business_ui.js || { echo "Falta acceso permanente a Mercado Pago en Mi negocio"; exit 1; }
grep -q "routes\['mi-negocio-productos'\]" business_hub_ui.js || { echo "Falta área Productos del Panel Negocio 2.0"; exit 1; }
grep -q "routes\['mi-negocio-promociones'\]" business_hub_ui.js || { echo "Falta área Promociones del Panel Negocio 2.0"; exit 1; }
grep -q "routes\['mi-negocio-estadisticas'\]" business_hub_ui.js || { echo "Falta área Estadísticas del Panel Negocio 2.0"; exit 1; }
grep -q "routes\['mi-negocio-configuracion'\]" business_hub_ui.js || { echo "Falta área Configuración del Panel Negocio 2.0"; exit 1; }
grep -q "DATOYA NEGOCIOS" business_hub_ui.js || { echo "Falta identidad DatoYa Negocios"; exit 1; }
grep -q "renderPremiumLock" business_hub_ui.js || { echo "Falta pantalla de candado premium"; exit 1; }
grep -q "Incluido con DatoYa Impulso" business_hub_ui.js || { echo "Falta identificar funciones premium en Panel Negocio"; exit 1; }
grep -q "Gratis vs DatoYa Impulso" business_impulse_plan_ui.js || { echo "Falta comparación clara de planes"; exit 1; }
grep -q "Hasta '+freeLimit" business_impulse_plan_ui.js || { echo "Falta mostrar límite del catálogo Gratis"; exit 1; }
grep -q "impulso_paid_catalog_limit" marketplace_admin_v2_ui.js || { echo "Admin no puede configurar límite catálogo Impulso"; exit 1; }
node -e 'const s=require("fs").readFileSync("production_start.js","utf8");const plan=s.indexOf("business_impulse_plan_assets");const hub=s.indexOf("business_hub_assets");if(plan<0||hub<0||hub<plan){throw new Error("Panel Negocio 2.0 no carga al final de los módulos comerciales")}'
echo "✅ Acceso Mercado Pago permanente"
echo "✅ Frontend comercial publicado"

# Legacy visual scripts must not ship in the final generated HTML.
LEGACY_PUBLIC_SCRIPTS=(
  chat_ui_fix.js home_request_fix.js worker_own_profile_ui.js nearby_ui.js
  worker_v2_ui.js worker_profile_fix.js worker_portfolio_ui.js worker_finance_ui.js
  request_photos_ui.js workflow_v2_ui.js evidence_ui.js review_ui.js reports_ui.js
  verification_worker_ui.js request_wizard_ui.js request_detail_ui_fix.js
  job_detail_ui.js job_flow_ui_bridge.js worker_onboarding_ui.js
  professional_account_hub_ui.js
)
for legacy in "${LEGACY_PUBLIC_SCRIPTS[@]}"; do
  if grep -q "/$legacy" public/index.html; then
    echo "ERROR: el HTML final todavía publica un script legacy: $legacy"
    exit 1
  fi
done
echo "✅ HTML público sin interfaces legacy"

# 7) Marcadores críticos del backend nuevo.
for marker in   "DATOYA MARKETPLACE ACCOUNT V2"   "DATOYA MARKET PRODUCTS V1"   "DATOYA COMMERCE BETA V1"   "DATOYA COMMERCE MERCADOPAGO V1"   "DATOYA GROWTH COMMERCIAL V1"   "DATOYA STRUCTURED HOURS V1"   "DATOYA DELIVERY V1"   "DATOYA PROMO ANALYTICS V1"   "DATOYA INTEGRATIONS STATUS V1" "DATOYA_SUPPORT_CENTER_V2" "DATOYA WEB PUSH V1"; do
  grep -q "$marker" server.js || { echo "Runtime comercial no montado: $marker"; exit 1; }
done
grep -q "DATOYA_ALLOW_LIVE_PAYMENTS" marketplace_payments_bootstrap.js || { echo "Falta candado de pagos reales Mercado Pago"; exit 1; }
grep -q "mercadopago/disconnect" marketplace_payments_bootstrap.js || { echo "Falta desconexión segura de Mercado Pago"; exit 1; }
grep -q "support_cases" support_center_bootstrap.js || { echo "Falta persistencia de casos de soporte"; exit 1; }
grep -q "api/admin/support-cases" support_center_bootstrap.js || { echo "Falta API admin de soporte"; exit 1; }
grep -q "api/businesses/:businessId/support-cases" support_center_bootstrap.js || { echo "Falta API privada de soporte para negocios"; exit 1; }
grep -q "api/admin/support-cases/:id/reply" support_center_bootstrap.js || { echo "Falta respuesta visible de soporte desde Admin"; exit 1; }
grep -q "support_case_messages" support_center_bootstrap.js || { echo "Falta conversación persistente de soporte"; exit 1; }
grep -q "routes\['mi-negocio-soporte'\]" business_support_ui.js || { echo "Falta panel de soporte para negocio"; exit 1; }
grep -q "routes\['mi-negocio-soporte-caso'\]" business_support_ui.js || { echo "Falta detalle conversacional de soporte para negocio"; exit 1; }
grep -q "routes.admin" admin_support_cases_ui.js || { echo "Falta panel admin de soporte"; exit 1; }
grep -q "DATOYA_MARKETPLACE_ADMIN_V2" marketplace_admin_v2_bootstrap.js || { echo "Falta backend Admin marketplace V2"; exit 1; }
grep -q "business_impulse_memberships" marketplace_admin_v2_bootstrap.js || { echo "Falta membresía DatoYa Impulso"; exit 1; }
grep -q "DATOYA_IMPULSO_CHECKOUT_ENABLED" marketplace_admin_v2_bootstrap.js || { echo "Falta candado de checkout Impulso"; exit 1; }
grep -q "api/businesses/:id/plan-access" marketplace_admin_v2_bootstrap.js || { echo "Falta API de permisos por plan"; exit 1; }
grep -q "CATALOG_LIMIT_REACHED" marketplace_products_bootstrap.js || { echo "Falta límite real de productos por plan"; exit 1; }
grep -q "IMPULSO_PLAN_REQUIRED" marketplace_commerce_bootstrap.js || { echo "Impulso Ahora no está protegido por membresía"; exit 1; }
grep -q "advanced||''" marketplace_growth_bootstrap.js || { echo "Falta candado de estadísticas avanzadas"; exit 1; }
grep -q "advanced||''" marketplace_promo_analytics_bootstrap.js || { echo "Falta candado de analítica promocional"; exit 1; }
grep -q "DATOYA_ALLOW_LIVE_PAYMENTS" marketplace_admin_v2_bootstrap.js || { echo "Falta candado de pagos reales en Impulso"; exit 1; }
grep -q "routes\['mi-negocio-plan'\]" business_impulse_plan_ui.js || { echo "Falta página de plan Impulso para negocio"; exit 1; }
grep -q "admin/marketplace-v2/impulso/gift" marketplace_admin_v2_ui.js || { echo "Falta gestión de cortesías Impulso en Admin"; exit 1; }
grep -q "'quarterly'" business_impulse_plan_ui.js || { echo "Falta opción de 3 meses en DatoYa Impulso"; exit 1; }
grep -q "AHORRA" business_impulse_plan_ui.js || { echo "Falta mostrar ahorro del plan trimestral"; exit 1; }
grep -q "ready_for_test:c.oauthConfigured&&c.webhookConfigured" mercadopago_source_bootstrap.js || { echo "La disponibilidad TEST de Mercado Pago depende incorrectamente de un token legacy"; exit 1; }
grep -q "mpHttp('POST','/v1/orders'" marketplace_payments_bootstrap.js || { echo "Checkout Pro TEST no usa Orders API"; exit 1; }
grep -q "payer:{email:'test@testuser.com'}" marketplace_payments_bootstrap.js || { echo "Orders TEST no usa payer técnico permitido"; exit 1; }
node -e 'const s=require("fs").readFileSync("production_start.js","utf8");const growth=s.indexOf("marketplace_growth_assets");const commerce=s.indexOf("marketplace_commerce_assets");if(growth<0||commerce<0||growth>commerce){throw new Error("El módulo de crecimiento vuelve a reemplazar la ruta del carrito")}'
grep -q "La cuenta no está verificada como vendedor TEST" marketplace_payments_bootstrap.js || { echo "Falta candado de vendedor TEST antes de checkout"; exit 1; }
grep -q "receivedAmount===expectedAmount" marketplace_payments_bootstrap.js || { echo "Falta validar el monto del pago Mercado Pago"; exit 1; }
grep -q "collectorId===String(conn.mp_user_id" marketplace_payments_bootstrap.js || { echo "Falta validar el vendedor receptor de Mercado Pago"; exit 1; }
grep -q "payment_status<>'paid'" marketplace_payments_bootstrap.js || { echo "Falta transición idempotente a pago aprobado"; exit 1; }
echo "✅ Mercado Pago mantiene pagos reales bloqueados por defecto"
echo "✅ Backend marketplace montado"

# 8) Regresiones de seguridad que siguen siendo compartidas por la plataforma.
bash test_security_regression.sh
node marketplace_beta_smoketest.js

echo "DatoYa marketplace CI: OK"
