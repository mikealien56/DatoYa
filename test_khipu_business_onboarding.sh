#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "KHIPU ONBOARDING QA FAIL: $1"; exit 1; }

node --check khipu_business_onboarding_bootstrap.js
node --check business_hub_ui.js
grep -q "CREATE TABLE IF NOT EXISTS business_khipu_onboarding" khipu_business_onboarding_bootstrap.js || fail "Falta tabla de onboarding"
grep -q "pending_integrator" khipu_business_onboarding_bootstrap.js || fail "Falta estado listo para integrador"
# El onboarding Khipu se conserva en backend para históricos, pero no en el panel actual.
! grep -q 'Khipu' business_hub_ui.js || fail "Khipu volvió a la vista comercial"
grep -q 'Mercado Pago' business_hub_ui.js || fail "Panel principal no apunta a Mercado Pago"
grep -q "routes\['mi-negocio-pagos'\]" direct_merchant_payments_ui.js || fail "Falta vista vigente de pagos"
if grep -Eqi "Para la beta real|Desarrollo / TEST|TEST activo|<strong>TEST</strong>" business_hub_ui.js; then fail "Panel Negocio vuelve a exponer lenguaje Beta/TEST"; fi
grep -q "contact_role" khipu_business_onboarding_bootstrap.js || fail "Faltan datos de contacto requeridos por Khipu"
if grep -Eqi "bank_account_number|bank_password|bank_secret|bank_pin" khipu_business_onboarding_bootstrap.js; then fail "No se deben almacenar credenciales bancarias"; fi

echo "Khipu histórico/backend QA y pantalla Mercado Pago limpia OK"
