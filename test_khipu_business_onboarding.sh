#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "KHIPU ONBOARDING QA FAIL: $1"; exit 1; }

node --check khipu_business_onboarding_bootstrap.js
node --check business_hub_ui.js
grep -q "CREATE TABLE IF NOT EXISTS business_khipu_onboarding" khipu_business_onboarding_bootstrap.js || fail "Falta tabla de onboarding"
grep -q "pending_integrator" khipu_business_onboarding_bootstrap.js || fail "Falta estado listo para integrador"
grep -q "No te pediremos claves bancarias" business_hub_ui.js || fail "La UI no explica que DatoYa no pide claves bancarias"
grep -q "Preparar activación de cobros" business_hub_ui.js || fail "Falta CTA simple de activación"
grep -q "billing_identifier" business_hub_ui.js || fail "Falta RUT de facturación"
grep -q "business_activity" business_hub_ui.js || fail "Falta giro del negocio"
grep -q "Antes de activar cobros" business_hub_ui.js || fail "Panel Khipu no explica el estado previo a activación"
grep -q "En preparación" business_hub_ui.js || fail "Panel Khipu no muestra un estado comercial claro"
if grep -Eqi "Para la beta real|Desarrollo / TEST|TEST activo|<strong>TEST</strong>" business_hub_ui.js; then fail "Panel Negocio vuelve a exponer lenguaje Beta/TEST"; fi
grep -q "contact_role" khipu_business_onboarding_bootstrap.js || fail "Faltan datos de contacto requeridos por Khipu"
if grep -Eqi "bank_account_number|bank_password|bank_secret|bank_pin" khipu_business_onboarding_bootstrap.js; then fail "No se deben almacenar credenciales bancarias"; fi

echo "Khipu business onboarding QA suite OK"
