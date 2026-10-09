#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
fail(){ echo "BUSINESS LOADING QA FAIL: $1"; exit 1; }

node --check business_hub_ui.js
node --check direct_merchant_payments_ui.js
node --check business_growth_plans_v2_ui.js
node --check business_impulse_plan_ui.js

grep -q "DATOYA_HUB_API_TIMEOUT_V1" business_hub_ui.js || fail "Panel Negocio no tiene timeout frontend"
grep -q "HUB_TIMEOUT_MS=18000" business_hub_ui.js || fail "Timeout del Panel Negocio no está definido"
grep -q "const hubApi=" business_hub_ui.js || fail "Panel Negocio no enruta APIs por timeout"
grep -q "Cargando formas de pago" direct_merchant_payments_ui.js || fail "Pagos directos no tiene estado de carga visible"
grep -q "No pudimos cargar los pagos" direct_merchant_payments_ui.js || fail "Pagos directos no tiene estado de error"
grep -q "Reintentar" direct_merchant_payments_ui.js || fail "Pagos directos no permite reintento"
grep -q "puede recibir pagos al retirar, al entregar o por transferencia" direct_merchant_payments_ui.js || fail "UI no identifica formas de pago directo del negocio"
grep -q "Conecta tu cuenta para ofrecer pagos online" direct_merchant_payments_ui.js || fail "Panel de pagos no muestra conexión simple"
grep -q "2% sobre el subtotal de productos" legal_final_ui.js || fail "La tarifa del servicio debe quedar explicada en Términos de pagos"
grep -q "Cargo por servicio en compras online" legal_final_ui.js || fail "Faltan condiciones comerciales para el comprador"

grep -q "planLoading" business_growth_plans_v2_ui.js || fail "Growth Plans V2 no muestra carga explícita"
grep -q "checkoutBusy" business_growth_plans_v2_ui.js || fail "Growth Plans V2 permite doble clic"
grep -q "syncBusy" business_growth_plans_v2_ui.js || fail "Growth Plans V2 permite doble sincronización"
grep -q "DATOYA_PLAN_LOADING_GUARD_V1" business_impulse_plan_ui.js || fail "Plan legacy de compatibilidad perdió guard de carga"
grep -q "PLAN_TIMEOUT_MS=18000" business_impulse_plan_ui.js || fail "Timeout del Plan no está definido"
grep -q "planLoading" business_impulse_plan_ui.js || fail "Plan no muestra carga explícita"
grep -q "planError" business_impulse_plan_ui.js || fail "Plan no muestra error recuperable"
grep -q "checkoutBusy" business_impulse_plan_ui.js || fail "Checkout permite doble clic"
grep -q "syncBusy" business_impulse_plan_ui.js || fail "Sincronización permite doble clic"
grep -q "dyWasDisabled" business_impulse_plan_ui.js || fail "Plan no conserva botones originalmente bloqueados"
grep -q "reintentar sin generar un cobro duplicado" business_impulse_plan_ui.js || fail "Timeout de pago no explica reintento seguro"

echo "Business loading/timeouts QA OK"
