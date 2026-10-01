#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== DatoYa CI base: marketplace comercial ==="
npm audit --omit=dev --audit-level=high
echo "✅ Dependencias de producción sin vulnerabilidades altas/críticas"
grep -q "legal_consent_recorded" account_security_bootstrap.js || { echo "Registro no persiste consentimiento legal"; exit 1; }
grep -q "LEGAL_ENFORCEMENT || 'true'" account_security_bootstrap.js || { echo "Enforcement legal no queda activo por defecto"; exit 1; }
echo "✅ Consentimiento legal integrado al registro"
grep -q "Versión: 25 de septiembre de 2026" legal_final_ui.js || { echo "Textos legales no están versionados al 25-09-2026"; exit 1; }
grep -q "Khipu" legal_final_ui.js || { echo "Textos legales no reflejan Khipu"; exit 1; }
grep -q "1 de diciembre de 2026" legal_final_ui.js || { echo "Política de privacidad no contempla transición Ley 21.719"; exit 1; }
if grep -Eqi 'mercadopago|Mercado Pago' legal_final_ui.js account_security_bootstrap.js; then echo "Quedó una referencia legal/seguridad a Mercado Pago"; exit 1; fi
grep -q "2026-09-25-marketplace2" marketplace_legal_version_fix.js || { echo "Falta nueva versión de consentimiento legal"; exit 1; }
echo "✅ Textos legales 25-09-2026 alineados con Khipu"
grep -q "current_legal_consent_enforcement_bootstrap" production_start.js || { echo "Guard de consentimiento vigente no montado"; exit 1; }
grep -q "LEGAL_CONSENT_REQUIRED" app.js || { echo "Frontend no maneja reaceptación legal"; exit 1; }
echo "✅ Reaceptación de versión legal vigente protegida"
bash test_beta_private_ui.sh
bash test_mobile_account_role.sh
bash test_ui_navigation_consistency.sh
bash test_mobile_notifications.sh
bash test_password_reset_links.sh
bash test_business_loading_guards.sh
bash test_beta_private_features.sh
bash test_pwa_security.sh
bash test_khipu_business_onboarding.sh
node test_khipu_integrator.js
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
grep -q "Proveedor de datos:" production_start.js || { echo "Falta diagnóstico seguro del proveedor PostgreSQL"; exit 1; }
grep -q "ADMIN_DISPLAY_NAME" production_mode_bootstrap.js || { echo "Falta nombre visible configurable del administrador"; exit 1; }
node test_postgres_connection.js
grep -q "CREATE TABLE IF NOT EXISTS market_categories" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS businesses" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS business_category_links" postgres/001_marketplace_foundation.sql
grep -q "CREATE TABLE IF NOT EXISTS market_account_types" postgres/002_market_account_types.sql
grep -q "ON CONFLICT (user_id) DO NOTHING" postgres/002_market_account_types.sql
grep -q "Falta tabla PostgreSQL: market_account_types" postgres_migrate.js
grep -q "CREATE TABLE IF NOT EXISTS market_coupons" postgres/008_marketplace_coupons.sql
grep -q "CREATE TABLE IF NOT EXISTS coupon_redemptions" postgres/008_marketplace_coupons.sql
grep -q "Falta tabla PostgreSQL: market_coupons" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: coupon_redemptions" postgres_migrate.js
grep -q "CREATE TABLE IF NOT EXISTS market_coupon_products" postgres/009_marketplace_coupon_scopes.sql
grep -q "CREATE TABLE IF NOT EXISTS market_coupon_categories" postgres/009_marketplace_coupon_scopes.sql
grep -q "Falta tabla PostgreSQL: market_coupon_products" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: market_coupon_categories" postgres_migrate.js
grep -q "CREATE TABLE IF NOT EXISTS founder_invites" postgres/010_marketplace_growth_program.sql
grep -q "CREATE TABLE IF NOT EXISTS business_growth_profiles" postgres/010_marketplace_growth_program.sql
grep -q "CREATE TABLE IF NOT EXISTS business_referrals" postgres/010_marketplace_growth_program.sql
grep -q "ADD COLUMN IF NOT EXISTS invitee_email" postgres/013_unique_founder_invites.sql
grep -q "ADD COLUMN IF NOT EXISTS used_by_user_id" postgres/013_unique_founder_invites.sql
grep -q "Falta tabla PostgreSQL: founder_invites" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: business_growth_profiles" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: business_referrals" postgres_migrate.js
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
grep -q "CREATE TABLE IF NOT EXISTS business_khipu_onboarding" postgres/014_khipu_business_onboarding.sql
grep -q "Falta tabla PostgreSQL: business_khipu_onboarding" postgres_migrate.js
grep -q "khipu_business_onboarding_bootstrap" production_start.js
grep -q "business_growth_plans_v2_bootstrap" production_start.js || { echo "Growth Plans V2 backend no montado"; exit 1; }
grep -q "business_growth_plans_v2_assets" production_start.js || { echo "Growth Plans V2 UI no publicada"; exit 1; }
grep -q "direct_merchant_payments_bootstrap" production_start.js || { echo "Pagos directos backend no montado"; exit 1; }
grep -q "direct_merchant_payments_assets" production_start.js || { echo "Pagos directos UI no publicada"; exit 1; }
grep -q "customer_club_bootstrap" production_start.js || { echo "DatoYa Club backend no montado"; exit 1; }
grep -q "customer_club_assets" production_start.js || { echo "DatoYa Club UI no publicada"; exit 1; }
grep -q "DATOYA_CUSTOMER_CLUB_V1" customer_club_bootstrap.js || { echo "Falta backend DatoYa Club"; exit 1; }
grep -q "DATOYA_CUSTOMER_CLUB_WEBHOOK_V1" customer_club_bootstrap.js || { echo "Falta webhook DatoYa Club"; exit 1; }
grep -q "Caza Ya" customer_club_ui.js || { echo "Falta Caza Ya en Club"; exit 1; }
grep -q "Junta DatoYa" customer_club_ui.js || { echo "Falta Junta DatoYa en Club"; exit 1; }
grep -q "Sin renovación automática" customer_club_ui.js || { echo "Club no aclara renovación"; exit 1; }
grep -q "customer_club_gifts" customer_club_bootstrap.js || { echo "Falta almacenamiento de Sorpresa Club"; exit 1; }
grep -q "dyClubClaimGift" customer_club_ui.js || { echo "Cliente no puede abrir Sorpresa Club"; exit 1; }
grep -q "__dyClubTurboScanAll" customer_club_bootstrap.js || { echo "Radar Turbo no tiene comportamiento real"; exit 1; }
grep -q "#/admin/club" marketplace_admin_v2_ui.js || { echo "Admin no expone Club clientes"; exit 1; }
grep -q "dyGiftCustomerClub" marketplace_admin_v2_ui.js || { echo "Admin no puede enviar Sorpresa Club"; exit 1; }
grep -q "DATOYA_DIRECT_MERCHANT_PAYMENTS_V1" direct_merchant_payments_bootstrap.js || { echo "Falta backend de pagos directos"; exit 1; }
grep -q "DATOYA_ORDER_KHIPU_DISABLED_V1" direct_merchant_payments_bootstrap.js || { echo "Checkout Khipu de pedidos no está bloqueado"; exit 1; }
grep -q "ORDER_KHIPU_DISABLED_V1" khipu_payments_ui.js || { echo "Frontend aún intenta cobrar pedidos con Khipu"; exit 1; }
grep -q "Exigir pago antes de preparar" direct_merchant_payments_ui.js || { echo "Falta protección de prepago en UI"; exit 1; }
grep -q "DATOYA_GROWTH_PLANS_V2" business_growth_plans_v2_bootstrap.js || { echo "Falta backend Growth Plans V2"; exit 1; }
grep -q "business_growth_plan_payments" business_growth_plans_v2_bootstrap.js || { echo "Falta persistencia de pagos Growth Plans V2"; exit 1; }
grep -q "Impulso Premium" business_growth_plans_v2_ui.js || { echo "Falta nivel Premium en planes"; exit 1; }
grep -q "\[1,7,15,30\]" business_growth_plans_v2_ui.js || { echo "Faltan duraciones 1/7/15/30"; exit 1; }
grep -q "app.get('/api/businesses/:id/khipu-onboarding'" khipu_business_onboarding_bootstrap.js
grep -q "app.post('/api/businesses/:id/khipu-onboarding/start'" khipu_business_onboarding_bootstrap.js
grep -q "No te pediremos claves bancarias" business_hub_ui.js
grep -q "CREATE TABLE IF NOT EXISTS commerce_refund_requests" postgres/012_commerce_refunds.sql
grep -q "CREATE TABLE IF NOT EXISTS commerce_refund_events" postgres/012_commerce_refunds.sql
grep -q "Falta tabla PostgreSQL: commerce_refund_requests" postgres_migrate.js
grep -q "Falta tabla PostgreSQL: commerce_refund_events" postgres_migrate.js
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
curl -fsS http://localhost:3000/api/public/business-plans | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["rule"].startswith("DatoYa no cobra comisión"); assert len(d["offers"])==3; assert d["durations"]==[1,7,15,30]' || { echo "Planes públicos de negocio incorrectos"; exit 1; }
curl -fsS http://localhost:3000/api/public/club | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["no_auto_renew"] is True; assert int(d["free_hunts"])>=1' || { echo "Club público incorrecto"; exit 1; }
CATS=$(curl -fsS http://localhost:3000/api/market/categories | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["categories"]))')
[ "$CATS" -ge 20 ] || { echo "Catálogo comercial incompleto: $CATS"; exit 1; }
curl -fsS http://localhost:3000/api/market/categories | python3 -c 'import sys,json; c=json.load(sys.stdin)["categories"]; o=next((x for x in c if x["slug"]=="opticas"),None); assert o and o["name"]=="Ópticas" and o["icon"]=="👓"' || { echo "Falta categoría Ópticas"; exit 1; }
echo "✅ Healthcheck + categorías comerciales"
node test_email_activation.js
node test_customer_controls.js
node test_founder_welcome.js
bash test_refunds_flow.sh

# 5) Rutas privadas del marketplace no deben abrir sin sesión.
for path in businesses/mine businesses/1/support-cases businesses/1/plan-access businesses/1/growth-plans businesses/1/growth-access businesses/1/direct-payment-settings orders/1/direct-payment-options club/overview club/gifts admin/club-gifts/members businesses/1/readiness businesses/1/khipu-onboarding orders/mine admin/support-cases admin/marketplace-v2/summary admin/beta-launch push/config; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/$path")
  [ "$code" = "401" ] || { echo "Ruta privada incorrecta /api/$path HTTP $code"; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/admin/marketplace/businesses")
[ "$code" = "401" ] || { echo "Admin marketplace no está protegido HTTP $code"; exit 1; }
echo "✅ Autorización base"

echo "=== E2E Cliente + Negocio ==="
bash test_two_accounts_flow.sh
echo "=== E2E readiness beta ==="
bash test_beta_readiness_flow.sh
echo "=== E2E integridad de pedidos ==="
bash test_order_integrity_flow.sh
echo "=== E2E cupones ==="
bash test_coupons_flow.sh
echo "=== E2E Fundadores + crecimiento ==="
bash test_growth_program_flow.sh
bash test_featured_business_flow.sh
echo "=== E2E recuperación + verificación ==="
bash test_auth_recovery_flow.sh
echo "=== QA Admin Marketplace V2 ==="
bash test_admin_marketplace_v2.sh

# Centro de soporte público: debe validar datos antes de intentar enviar correo.
SUPPORT_CODE=$(curl -s -o /tmp/dy_support_invalid.json -w '%{http_code}' -X POST "http://localhost:3000/api/support/contact" -H 'Content-Type: application/json' -d '{"name":"Prueba","email":"correo-invalido","subject":"Ayuda","message":"Necesito ayuda con DatoYa"}')
[ "$SUPPORT_CODE" = "400" ] || { echo "Validación soporte incorrecta HTTP $SUPPORT_CODE"; cat /tmp/dy_support_invalid.json; exit 1; }
echo "✅ Centro de soporte montado y validando"

# 6) Assets que definen la beta comercial.
for asset in   manifest.webmanifest service-worker.js local_market_home.js marketplace_account_ui.js marketplace_public_beta_ui.js   marketplace_business_ui.js marketplace_commerce_ui.js khipu_payments_ui.js   marketplace_growth_ui.js marketplace_hours_ui.js marketplace_guided_demo_ui.js marketplace_delivery_ui.js marketplace_order_fulfillment_ui.js marketplace_promo_analytics_ui.js marketplace_coupons_ui.js marketplace_coupons.css marketplace_integrations_ui.js marketplace_refunds_ui.js marketplace_refunds.css beta_launch_ui.js beta_launch.css support_center_ui.js business_support_ui.js support_center.css admin_support_cases_ui.js marketplace_admin_v2_ui.js business_hub_ui.js business_hub.css marketplace_admin_v2.css business_impulse_plan_ui.js business_impulse_plan.css business_growth_plans_v2_ui.js business_growth_plans_v2.css direct_merchant_payments_ui.js direct_merchant_payments.css customer_club_ui.js customer_club.css home_structure_v3.js home_structure_v3.css   marketplace_legacy_route_guard.js   marketplace_growth.css marketplace_hours.css marketplace_guided_demo.css marketplace_delivery.css marketplace_promo_analytics.css marketplace_integrations.css   brand/datoya-logo-horizontal.png; do
  curl -fsS "http://localhost:3000/$asset" >/dev/null || { echo "Archivo estático no publicado: $asset"; exit 1; }
done
grep -q "Cuenta administrador" marketplace_account_ui.js || { echo "Mi DatoYa no distingue la cuenta administradora"; exit 1; }
grep -q "href=\"#/admin\"" marketplace_account_ui.js || { echo "Mi DatoYa admin no enlaza al panel administrativo"; exit 1; }
grep -q 'dy-pwa-register' public/index.html || { echo "Falta registro del Service Worker PWA"; exit 1; }
grep -q 'serviceWorker.register("/service-worker.js"' public/index.html || { echo "Registro PWA no apunta al Service Worker de DatoYa"; exit 1; }
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
echo "✅ Khipu reservado a servicios DatoYa; pedidos pagan directo al negocio"
echo "✅ Frontend comercial publicado"

# Limpieza UX: evitar repetir CTAs y accesos que ya existen en la navegación principal.
if grep -q 'dy-local-banner' marketplace_public_beta_ui.js; then echo "Home vuelve a repetir el CTA de registro de negocio"; exit 1; fi
grep -q "Tu cuenta de administración y accesos principales" marketplace_account_ui.js || { echo "Mi DatoYa admin volvió a duplicar todo el menú administrativo"; exit 1; }
node <<'NODE'
const fs=require('fs');
const s=fs.readFileSync('business_hub_ui.js','utf8');
const marker='CONFIGURACIÓN ADICIONAL';
const i=s.indexOf(marker), j=s.indexOf('await addHubFrame',i);
if(i<0||j<0) throw new Error('No se encontró Configuración adicional del Panel Negocio');
const block=s.slice(i,j);
for(const duplicated of ['mi-negocio-horarios/','mi-negocio-plan/','mi-negocio-soporte/']){
  if(block.includes(duplicated)) throw new Error('Configuración adicional repite una sección que ya está en la navegación: '+duplicated);
}
NODE
echo "✅ Limpieza UX sin accesos repetidos"


# La beta pública no debe mostrar escaparates ni ofertas ficticias.
if grep -Eq 'marketplace_demo_(showcase|pitch)' public/index.html; then
  echo "ERROR: la portada final todavía carga escaparates DEMO"
  exit 1
fi
for demo_asset in marketplace_demo_showcase_ui.js marketplace_demo_pitch_ui.js marketplace_demo_showcase.css marketplace_demo_pitch.css; do
  [ ! -e "public/$demo_asset" ] || { echo "ERROR: asset DEMO sigue publicado: $demo_asset"; exit 1; }
done
! grep -q "demoItems" marketplace_impulse_home.js || { echo "Impulso Ahora todavía usa comercios ficticios"; exit 1; }
grep -q "No hay Impulsos activos ahora" marketplace_impulse_home.js || { echo "Falta estado vacío real de Impulso Ahora"; exit 1; }
! grep -q "renderDemo" marketplace_weekly_home.js || { echo "Oferta semanal todavía tiene fallback DEMO"; exit 1; }
grep -q "section.hidden=true" marketplace_weekly_home.js || { echo "Oferta semanal vacía no se oculta"; exit 1; }
echo "✅ Portada beta sin escaparates ficticios"

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
for marker in   "DATOYA MARKETPLACE ACCOUNT V2"   "DATOYA MARKET PRODUCTS V1"   "DATOYA COMMERCE BETA V1"   "DATOYA KHIPU PAYMENTS V1"   "DATOYA GROWTH COMMERCIAL V1"   "DATOYA STRUCTURED HOURS V1"   "DATOYA DELIVERY V1"   "DATOYA PROMO ANALYTICS V1"   "DATOYA INTEGRATIONS STATUS V1" "DATOYA COMMERCE REFUNDS V1" "DATOYA BETA LAUNCH READINESS V1" "DATOYA_SUPPORT_CENTER_V2" "DATOYA WEB PUSH V1"; do
  grep -q "$marker" server.js || { echo "Runtime comercial no montado: $marker"; exit 1; }
done
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
grep -q "checkout_enabled:typeof __khConfigured" marketplace_admin_v2_bootstrap.js || { echo "Falta control de checkout Khipu para Impulso"; exit 1; }
grep -q "api/businesses/:id/plan-access" marketplace_admin_v2_bootstrap.js || { echo "Falta API de permisos por plan"; exit 1; }
grep -q "CATALOG_LIMIT_REACHED" marketplace_products_bootstrap.js || { echo "Falta límite real de productos por plan"; exit 1; }
grep -q "IMPULSO_PLAN_REQUIRED" marketplace_commerce_bootstrap.js || { echo "Impulso Ahora no está protegido por membresía"; exit 1; }
grep -q "advanced||''" marketplace_growth_bootstrap.js || { echo "Falta candado de estadísticas avanzadas"; exit 1; }
grep -q "advanced||''" marketplace_promo_analytics_bootstrap.js || { echo "Falta candado de analítica promocional"; exit 1; }
grep -q "KHIPU_LIVE_BLOCKED" marketplace_admin_v2_bootstrap.js || { echo "Falta candado de pagos Khipu reales en Impulso"; exit 1; }
grep -q "routes\['mi-negocio-plan'\]" business_growth_plans_v2_ui.js || { echo "Falta página Growth Plans V2 para negocio"; exit 1; }
grep -q "admin/marketplace-v2/growth-plans/gift" business_growth_plans_v2_bootstrap.js || { echo "Falta gestión de cortesías Growth Plans V2"; exit 1; }
grep -q "\[1,7,15,30\]" business_growth_plans_v2_ui.js || { echo "Faltan duraciones 1/7/15/30"; exit 1; }
grep -q "Impulso Premium" business_growth_plans_v2_ui.js || { echo "Falta comparación de niveles actuales"; exit 1; }
node -e 'const s=require("fs").readFileSync("production_start.js","utf8");const growth=s.indexOf("marketplace_growth_assets");const commerce=s.indexOf("marketplace_commerce_assets");if(growth<0||commerce<0||growth>commerce){throw new Error("El módulo de crecimiento vuelve a reemplazar la ruta del carrito")}'
grep -q "marketplace_order_integrity_bootstrap" production_start.js || { echo "Integridad de pedidos no está montada"; exit 1; }
grep -q "marketplace_coupons_bootstrap" production_start.js || { echo "Cupones no están montados"; exit 1; }
grep -q "DATOYA MARKET COUPONS V1" server.js || { echo "Runtime de cupones no está montado"; exit 1; }
grep -q "DATOYA MARKET COUPONS V2" server.js || { echo "Runtime de cupones V2 no está montado"; exit 1; }
grep -q "marketplace_growth_program_bootstrap" production_start.js || { echo "Programa de Fundadores no está montado"; exit 1; }
grep -q "business_model:'no_commission'" marketplace_growth_program_bootstrap.js || { echo "Programa de crecimiento no declara modelo sin comisión"; exit 1; }
grep -q "effective_rate:0" marketplace_growth_program_bootstrap.js || { echo "Todavía existe comisión efectiva en pedidos"; exit 1; }
grep -q "home_structure_v3_assets" production_start.js || { echo "Home Structure V3 no está publicado"; exit 1; }
grep -q "0% comisión DatoYa" home_structure_v3.js || { echo "Portada no explica el modelo sin comisión"; exit 1; }
grep -q "DatoYa Club" home_structure_v3.js || { echo "Portada no explica Club"; exit 1; }
grep -q "Impulso+" home_structure_v3.js || { echo "Portada no compara planes de negocio"; exit 1; }
grep -q "marketplace_refunds_bootstrap" production_start.js || { echo "Devoluciones no están montadas"; exit 1; }
grep -q "marketplace_refunds_assets" production_start.js || { echo "UI de devoluciones no está publicada"; exit 1; }
grep -q "beta_launch_readiness_bootstrap" production_start.js || { echo "Readiness beta no está montado"; exit 1; }
grep -q "beta_launch_assets" production_start.js || { echo "UI Control Beta no está publicada"; exit 1; }
grep -q "api/businesses/:id/readiness" beta_launch_readiness_bootstrap.js || { echo "Falta readiness del Negocio"; exit 1; }
grep -q "api/admin/beta-launch" beta_launch_readiness_bootstrap.js || { echo "Falta Control Beta Admin"; exit 1; }
grep -q "Tu negocio está listo para recibir pedidos" beta_launch_ui.js || { echo "Falta estado Listo para vender"; exit 1; }
grep -q "Negocio Fundador DatoYa" beta_launch_ui.js || { echo "Falta identificación de Fundador"; exit 1; }
grep -q "api/orders/:id/refunds" marketplace_refunds_bootstrap.js || { echo "Falta solicitud de devolución Cliente"; exit 1; }
grep -q "api/businesses/:id/refunds/:refundId/decision" marketplace_refunds_bootstrap.js || { echo "Falta gestión de devolución por Negocio"; exit 1; }
grep -q "api/admin/refunds/:id/resolve" marketplace_refunds_bootstrap.js || { echo "Falta escalamiento de devolución a Admin"; exit 1; }
grep -q "DATOYA GROWTH PROGRAM V1" server.js || { echo "Runtime de crecimiento no está montado"; exit 1; }
grep -q "__dyGrowthOnOrderCompleted" marketplace_growth_program_bootstrap.js || { echo "Referidos no reaccionan a pedidos completados"; exit 1; }
grep -q "invitation_code" marketplace_account_ui.js || { echo "Registro no permite código Fundador"; exit 1; }
grep -q "routes\['registro-fundador'\]" marketplace_account_ui.js || { echo "Falta enlace personal de Fundador"; exit 1; }
grep -q "check-email" marketplace_growth_program_bootstrap.js || { echo "Invitación Fundador no valida correo"; exit 1; }
grep -q "invitee_email" marketplace_growth_program_bootstrap.js || { echo "Invitación Fundador no está ligada al correo"; exit 1; }
grep -q "status='used'" marketplace_growth_program_bootstrap.js || { echo "Invitación Fundador no se consume"; exit 1; }
grep -q "dyShareFounderInvite" marketplace_admin_v2_ui.js || { echo "Admin no puede compartir invitación Fundador"; exit 1; }
grep -q "Solo en DatoYa" marketplace_business_ui.js || { echo "Negocio no puede marcar promoción exclusiva"; exit 1; }
grep -q "admin/fundadores" marketplace_admin_v2_ui.js || { echo "Admin no expone Fundadores"; exit 1; }
grep -q "market_coupon_products" marketplace_coupons_bootstrap.js || { echo "Falta alcance por producto"; exit 1; }
grep -q "market_coupon_categories" marketplace_coupons_bootstrap.js || { echo "Falta alcance por categoría"; exit 1; }
grep -q "sales_generated" marketplace_coupons_bootstrap.js || { echo "Faltan métricas de ventas por cupón"; exit 1; }
grep -q "scope_mode" marketplace_coupons_ui.js || { echo "UI no permite elegir alcance del cupón"; exit 1; }
grep -q "client_request_id" marketplace_order_integrity_bootstrap.js || { echo "Falta idempotencia de pedidos"; exit 1; }
grep -q "deliveryFee=0" marketplace_order_integrity_bootstrap.js || { echo "Despacho no se calcula en servidor"; exit 1; }
grep -q "deliveryDistanceKm>radius" marketplace_order_integrity_bootstrap.js || { echo "Radio de despacho no se valida cuando hay GPS"; exit 1; }
grep -q "pickup-qr.svg" marketplace_order_integrity_bootstrap.js || { echo "Falta QR de retiro"; exit 1; }
grep -q "pickup/verify" marketplace_order_integrity_bootstrap.js || { echo "Falta verificación de retiro"; exit 1; }
grep -q "marketplace_order_fulfillment_bootstrap" production_start.js || { echo "Fulfillment QR/email no está montado"; exit 1; }
grep -q "fulfillment-qr.svg" marketplace_order_fulfillment_bootstrap.js || { echo "Falta QR unificado de entrega"; exit 1; }
grep -q "delivery/verify" marketplace_order_fulfillment_bootstrap.js || { echo "Falta verificación de despacho"; exit 1; }
grep -q "fulfillment-email" marketplace_order_fulfillment_bootstrap.js || { echo "Falta reenvío de QR/código por correo"; exit 1; }
grep -q "dyStartFulfillmentScanner" marketplace_order_fulfillment_ui.js || { echo "Falta lector QR interno del negocio"; exit 1; }
grep -q "Valida el código o QR de retiro" marketplace_order_integrity_bootstrap.js || { echo "Pedido retiro puede completarse sin validar"; exit 1; }
grep -q "ensureCheckoutRequestId" marketplace_commerce_ui.js || { echo "Frontend no conserva idempotencia del checkout"; exit 1; }
grep -q "routes.retiro" marketplace_commerce_ui.js || { echo "Falta ruta de escaneo QR"; exit 1; }
grep -q "DATOYA_ORDER_KHIPU_DISABLED_V1" direct_merchant_payments_bootstrap.js || { echo "Checkout Khipu de pedidos no está bloqueado"; exit 1; }
grep -q "DatoYa no procesa el pago de las ventas de los negocios" direct_merchant_payments_bootstrap.js || { echo "Falta regla de pago directo al negocio"; exit 1; }
grep -q "app.post('/api/khipu/webhook'" server.js || { echo "Falta webhook Khipu para servicios DatoYa"; exit 1; }
if grep -Eqi 'mercadopago|marketplace_payments_ui' public/index.html; then echo "El HTML público todavía referencia un proveedor de pago retirado"; exit 1; fi
echo "✅ Checkout de pedidos sin Khipu; servicios DatoYa protegidos"
echo "✅ Backend marketplace montado"

# 8) Regresiones de seguridad que siguen siendo compartidas por la plataforma.
bash test_security_regression.sh
node marketplace_beta_smoketest.js

echo "DatoYa marketplace CI: OK"

# Auditoría de modelo de ingresos 2026-10-01
! grep -q "Comisiones DatoYa" marketplace_admin_v2_ui.js || { echo "Admin aún muestra comisiones por venta"; exit 1; }
! grep -q "GMV pagado" marketplace_admin_v2_ui.js || { echo "Admin aún usa GMV como ingreso DatoYa"; exit 1; }
! grep -q "Fee:" marketplace_admin_v2_ui.js || { echo "Pedidos Admin aún muestran fee DatoYa"; exit 1; }
grep -q "Servicios propios, no ventas de terceros" marketplace_admin_v2_ui.js || { echo "Admin no explica ingresos propios"; exit 1; }
grep -q "Pago directo al negocio" marketplace_admin_v2_ui.js || { echo "Admin pedidos no aclara pago directo"; exit 1; }

# DatoYa Club público debe informar antes de pedir registro
grep -q "routes\['club-info'\]=loadClubInfo" customer_club_ui.js || { echo "Falta página pública informativa de DatoYa Club"; exit 1; }
grep -q "const target='#/club-info'" home_structure_v3.js || { echo "Home todavía envía Club directo a registro/perfil"; exit 1; }
grep -q "DatoYa busca oportunidades por ti" customer_club_ui.js || { echo "Página Club no explica qué es"; exit 1; }
grep -q "CÓMO FUNCIONA" customer_club_ui.js || { echo "Página Club no explica funcionamiento"; exit 1; }
grep -q "DatoYa Gratis" customer_club_ui.js || { echo "Página Club no compara con Gratis"; exit 1; }

# Copy público: no explicar cómo gana dinero DatoYa
! grep -q "DatoYa gana por" home_structure_v3.js || { echo "La portada expone el modelo de ingresos de DatoYa"; exit 1; }
! grep -q "DatoYa cobra únicamente" marketplace_public_beta_ui.js || { echo "La portada explica cobros internos que no interesan al usuario"; exit 1; }
! grep -q "Club se paga a DatoYa" customer_club_ui.js || { echo "Club expone innecesariamente el flujo de ingreso de DatoYa"; exit 1; }
grep -q "El pago de la compra es directo al negocio" home_structure_v3.js || { echo "Falta mensaje útil de pago directo para clientes"; exit 1; }
