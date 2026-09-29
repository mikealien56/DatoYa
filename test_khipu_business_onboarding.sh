#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "KHIPU ONBOARDING QA FAIL: $1"; exit 1; }

node --check khipu_business_onboarding_bootstrap.js
node --check business_hub_ui.js
grep -q "CREATE TABLE IF NOT EXISTS business_khipu_onboarding" khipu_business_onboarding_bootstrap.js || fail "Falta tabla de onboarding"
grep -q "ready_for_integrator" khipu_business_onboarding_bootstrap.js || fail "Falta estado listo para integrador"
grep -q "No te pediremos claves bancarias" business_hub_ui.js || fail "La UI no explica que DatoYa no pide claves bancarias"
grep -q "Preparar activación de cobros" business_hub_ui.js || fail "Falta CTA simple de activación"
grep -q "billing_identifier" business_hub_ui.js || fail "Falta RUT de facturación"
grep -q "business_activity" business_hub_ui.js || fail "Falta giro del negocio"
grep -q "contact_role" khipu_business_onboarding_bootstrap.js || fail "Faltan datos de contacto requeridos por Khipu"
if grep -Eqi "bank_account|numero.*cuenta|bank_password|clave.*banc" khipu_business_onboarding_bootstrap.js; then fail "No se deben almacenar credenciales bancarias"; fi

echo "Khipu business onboarding QA suite OK"
