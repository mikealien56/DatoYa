#!/bin/bash
set -euo pipefail
node --check territory_resolver.js;node --check location_domain_schema.js;node --check location_domain_bootstrap.js;node --check local_location_ui.js;node test_location_domain.js
BASE_DIR="$(cd "$(dirname "$0")" && pwd)";cd "$BASE_DIR";rm -f datoya.db datoya.db-shm datoya.db-wal
if [ ! -d node_modules ]; then npm ci --silent; fi
node app_runtime_fix.js;node worker_demo_badge_runtime_fix.js
for js in app.js frontend_globals_bridge.js chat_ui_fix.js notifications_ui_fix.js worker_own_profile_ui.js worker_finance_ui.js search_ui_fix.js favorites_ui.js request_wizard_ui.js dispute_ui.js admin_dispute_ui_fix.js gps_ui.js workflow_v2_ui.js gps_map_ui.js gps_map_ui_v2.js protection_ui.js evidence_ui.js review_ui.js reports_ui.js request_photos_ui.js request_detail_ui_fix.js role_ui_fix.js admin_v2_ui.js admin_core_ui_fix.js admin_operations_ui.js worker_v2_ui.js professional_account_hub_ui.js verification_admin_ui.js verification_worker_ui.js request_target_ui.js home_request_fix.js direct_worker_category_fix.js job_finish_guard_ui.js worker_profile_fix.js worker_portfolio_ui.js nearby_ui.js job_detail_ui.js job_record_ui.js admin_disputes_ui.js worker_specialties_ui.js phone_security_ui.js free_beta_security_ui.js onboarding_flow_ui.js job_flow_ui_bridge.js; do if [ -f "$js" ] && ! node --check "$js";then echo "Error de sintaxis en $js";exit 1;fi;done
for js in server.js db.js territory_start.js production_start.js reports_bootstrap.js reports_routes.js reports_admin_fix.js request_photos_bootstrap.js evidence_schema.js evidence_bootstrap.js job_events_schema.js job_record_bootstrap.js job_record_assets.js chat_workflow_bootstrap.js admin_v2_bootstrap.js admin_operations_bootstrap.js admin_case_bootstrap.js verification_bootstrap.js verification_review_bootstrap.js protection_schema.js protection_bootstrap.js protection_flow_guard.js protection_complete_fix.js dispute_schema.js dispute_runtime_fix.js dispute_loader.js workflow_guard_bootstrap.js review_status_bootstrap.js request_target_bootstrap.js gps_schema.js gps_bootstrap.js gps_syntax_fix.js nearby_workers_bootstrap.js nearby_location_schema.js portfolio_runtime_fix.js app_runtime_fix.js worker_demo_badge_runtime_fix.js backend_runtime_fix.js account_security_bootstrap.js security_events_schema_fix.js database_integrity_bootstrap.js account_security_delivery_fix.js account_security_route_fix.js account_security_delivery_guard.js session_cookie_fix.js session_account_guard.js meeting_verification_bootstrap.js job_trust_center_bootstrap.js dispute_resolution_atomic_guard.js job_trust_accounting_fix.js accounting_uniqueness_bootstrap.js job_mutual_completion_guard.js job_flow_guard.js accepted_job_chat_guard.js chat_security_guard.js quote_acceptance_atomic_guard.js job_uniqueness_bootstrap.js worker_specialties_bootstrap.js worker_portfolio_bootstrap.js worker_search_bootstrap.js worker_specialties_discovery_bootstrap.js worker_discovery_quality.js worker_public_review_fix.js worker_profile_validation.js review_validation.js quote_validation.js request_validation.js request_photo_validation.js request_access_guard.js chile_security_bootstrap.js production_legacy_guard.js; do if [ -f "$js" ] && ! node --check "$js";then echo "Error de sintaxis en $js";exit 1;fi;done
if grep -q 'demoTag(1)' app.js;then echo "El frontend sigue marcando a todos los profesionales como DEMO";exit 1;fi
if ! grep -q 'routes.solicitud' request_detail_ui_fix.js||! grep -q 'request-quote-form' request_detail_ui_fix.js;then echo "Detalle de solicitud incompleto";exit 1;fi
if ! grep -q 'routes.ganancias' worker_finance_ui.js||! grep -q 'retiros automáticos están deshabilitados' worker_finance_ui.js;then echo "Finanzas beta no están protegidas";exit 1;fi
if ! grep -q 'review-status' review_status_bootstrap.js||! grep -q 'data-review-submit' review_ui.js;then echo "Reseñas incompletas";exit 1;fi
if ! grep -q 'renderDatoYaAdminDisputes' admin_disputes_ui.js;then echo "Centro admin de disputas no está montado";exit 1;fi
if grep -q 'Datos bancarios\|saveBankAccount\|/worker/bank' worker_v2_ui.js;then echo "El perfil profesional todavía expone el formulario bancario obsoleto";exit 1;fi
if grep -q "admin/banco\|🏦 Banco" admin_operations_ui.js;then echo "El panel todavía ofrece la sección bancaria obsoleta";exit 1;fi
if ! grep -q "mpValidatedConnection" mercadopago_source_bootstrap.js||! grep -q "'/users/me'" mercadopago_source_bootstrap.js;then echo "La conexión de Mercado Pago no valida OAuth con el proveedor";exit 1;fi
if ! grep -q 'Mercado Pago · No conectado' mercadopago_ui.js||! grep -q '✓ Mercado Pago conectado' mercadopago_ui.js;then echo "Estados de conexión Mercado Pago incompletos";exit 1;fi
if ! grep -q "split('?')\[0\]" app_runtime_fix.js;then echo "El router todavía confunde los filtros con la ruta";exit 1;fi
if ! grep -q '#/cerca?cat=' home_search_polish.js||! grep -q 'routes.cerca=mountCategory' nearby_ui.js;then echo "Las categorías de Inicio no abren la búsqueda cercana";exit 1;fi
if grep -q 'observer.observe(v' nearby_ui.js||! grep -q 'navigationEpoch' nearby_ui.js||! grep -q "if(isHome()).*route()" nearby_ui.js;then echo "La búsqueda cercana puede volver a reemplazar Inicio";exit 1;fi
if ! grep -q "'Cámaras y Seguridad'" home_search_polish.js||! grep -q 'mainCategories.map' home_search_polish.js;then echo "Cámaras y Seguridad no está fijada entre las categorías principales de Inicio";exit 1;fi
HOME_ASSET_VERSION="$(sed -nE 's/.*home_search_polish\.js\?v=([0-9]+).*/\1/p' home_search_polish_assets.js | head -1)"
if [ -z "$HOME_ASSET_VERSION" ] || [ "$HOME_ASSET_VERSION" -lt 4 ];then echo "El Inicio actualizado no invalida la caché anterior";exit 1;fi
node --check admin_navigation_polish.js
if ! grep -q 'data-admin-unified-nav' admin_navigation_polish.js||! grep -q "querySelectorAll('.admin-tabs,.admin-menu-organized,\[data-admin-compact-nav\]')" admin_navigation_polish.js;then echo "La navegación administrativa única no está instalada";exit 1;fi
if grep -q "routes.buscar=search" home_search_polish.js;then echo "Una capa antigua todavía reemplaza la búsqueda nacional";exit 1;fi
if ! grep -q 'DATOYA_CANONICAL_JOB_FLOW_V1' job_flow_guard.js;then echo "Guard del ciclo oficial no está presente";exit 1;fi
for field in urgency preferred_date budget region_id comuna_id address_detail photos;do if ! grep -q "$field" request_wizard_ui.js;then echo "Wizard no contempla $field";exit 1;fi;done
if ! grep -q 'if(target)return previousSolicitar' request_wizard_ui.js;then echo "Wizard no preserva flujo dirigido";exit 1;fi
# El flujo canónico verifica correos temporales. El token de prueba solo se expone dentro de esta ejecución CI.
export AUTH_TEST_MODE=true
export ADMIN_EMAIL='business-admin@datoya.test'
export ADMIN_PASSWORD='AdminPruebaSegura123'
npm start >/tmp/datoya-ci.log 2>&1 & PID=$!;cleanup(){ kill "$PID" >/dev/null 2>&1||true;wait "$PID" >/dev/null 2>&1||true;};trap cleanup EXIT
READY=0;for i in $(seq 1 120);do if curl -fsS http://localhost:3000/api/categories >/dev/null 2>&1;then READY=1;break;fi;if ! kill -0 "$PID" >/dev/null 2>&1;then echo "Servidor DatoYa no pudo iniciar";cat /tmp/datoya-ci.log;exit 1;fi;sleep 1;done
if [ "$READY" -ne 1 ];then echo "Timeout esperando DatoYa";cat /tmp/datoya-ci.log;exit 1;fi
curl -fsS http://localhost:3000/health|grep -q '"ok":true';echo "Healthcheck DatoYa OK"
bash test_business_domain.sh
CATEGORIES_JSON="$(curl -fsS http://localhost:3000/api/categories)"
node -e 'const data=JSON.parse(process.argv[1]);const category=(data.categories||[]).find(c=>c.name==="Cámaras y Seguridad");if(!category||category.icon!=="📹")process.exit(1)' "$CATEGORIES_JSON" || { echo "La categoría Cámaras y Seguridad no está integrada al catálogo real";exit 1; }
for marker in 'DATOYA CHAT WORKFLOW GUARD V1' 'VERIFICACIÓN PROFESIONAL DATOYA 2.0' 'DATOYA ADMIN OPERATIONS V1' 'DATOYA REVIEW STATUS V1' 'DATOYA DISPUTE RUNTIME V2';do grep -q "$marker" server.js||{ echo "Runtime no montado: $marker";exit 1;};done
for path in jobs/1/travel worker/verification-requests worker/earnings jobs/1/review-status jobs/1/dispute;do code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/$path");[ "$code" = "401" ]||{ echo "Ruta protegida incorrectamente /api/$path HTTP $code";exit 1;};done
for asset in frontend_globals_bridge.js chat_ui_fix.js notifications_ui_fix.js search_ui_fix.js favorites_ui.js request_wizard_ui.js dispute_ui.js admin_dispute_ui_fix.js request_detail_ui_fix.js job_record_ui.js worker_own_profile_ui.js worker_finance_ui.js review_ui.js reports_ui.js gps_ui.js nearby_ui.js datoya-logo.svg admin_v2_ui.js admin_core_ui_fix.js admin_operations_ui.js verification_admin_ui.js verification_worker_ui.js job_flow_ui_bridge.js;do curl -fsS "http://localhost:3000/$asset" >/dev/null||{ echo "Archivo estático no publicado: $asset";exit 1;};done
echo "Frontend/estáticos smoke test OK"
# Solo suites compatibles con modo real. Las suites antiguas dependían de cuentas/fixtures DEMO retirados.
bash test_security_regression.sh
bash test_job_flow_v2.sh
echo 'DatoYa real-mode CI OK'
