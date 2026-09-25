#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "PASSWORD RESET LINK QA FAIL: $1"; exit 1; }

node --check account_security_bootstrap.js
node --check account_security_ui.js

grep -Fq "__publicBaseUrl+'/#/restablecer/'+encodeURIComponent(token)" account_security_bootstrap.js || fail "Correo de recuperación no usa token como segmento de ruta"
grep -Fq "__publicBaseUrl+'/#/verificar-correo/'+encodeURIComponent(token)" account_security_bootstrap.js || fail "Correo de verificación no usa token como segmento de ruta"
grep -Fq "new URLSearchParams((location.hash.split('?')[1]||'')).get('token')" account_security_ui.js || fail "UI no acepta enlaces antiguos con ?token="
grep -Fq "/account_security_ui.js?v=5" account_security_assets.js || fail "Asset de seguridad no fue refrescado"

if grep -Fq "/#/restablecer?token=" account_security_bootstrap.js; then fail "Sigue generándose enlace roto de recuperación"; fi
if grep -Fq "/#/verificar-correo?token=" account_security_bootstrap.js; then fail "Sigue generándose enlace roto de verificación"; fi

echo "Password reset/email verification link QA suite OK"
