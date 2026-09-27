#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "PASSWORD RESET LINK QA FAIL: $1"; exit 1; }

node --check account_security_bootstrap.js
node --check account_security_ui.js

grep -Fq "__publicBaseUrl+'/#/restablecer/'+encodeURIComponent(token)" account_security_bootstrap.js || fail "Correo de recuperación no usa token como segmento de ruta"
grep -Fq "__publicBaseUrl+'/#/verificar-correo/'+encodeURIComponent(token)" account_security_bootstrap.js || fail "Correo de verificación no usa token como segmento de ruta"
grep -Fq "AUTH_PUBLIC_BASE_URL || 'https://datoya.cl'" account_security_bootstrap.js || fail "Enlaces auth no tienen origen canónico datoya.cl"
grep -Fq "RENDER_EXTERNAL_URL" account_security_bootstrap.js || fail "Origin Guard no contempla el dominio oficial de Render"
grep -Fq "AbortSignal.timeout(15000)" account_security_bootstrap.js || fail "Proveedor de correo no tiene timeout"
grep -Fq "verified_user_id:Number(row.user_id)" account_security_bootstrap.js || fail "Verificación no identifica la cuenta confirmada"
grep -Fq "DATOYA_AUTH_UI_GUARD_V1" account_security_ui.js || fail "UI de recuperación no tiene timeout"
grep -Fq "Number(current.id)!==Number(confirmed.verified_user_id)" account_security_ui.js || fail "UI no protege verificación cruzada entre cuentas"
grep -Fq "DATOYA_ACCOUNT_AUTH_GUARD_V1" marketplace_account_ui.js || fail "UI de cuenta no tiene guard de sesión"
grep -Fq "No pudimos cerrar la sesión actual" marketplace_account_ui.js || fail "Cambio Cliente/Negocio ignora fallos de logout"
grep -Fq "new URLSearchParams((location.hash.split('?')[1]||'')).get('token')" account_security_ui.js || fail "UI no acepta enlaces antiguos con ?token="
grep -Fq "/account_security_ui.js?v=6" account_security_assets.js || fail "Asset de seguridad no fue refrescado"

if grep -Fq "/#/restablecer?token=" account_security_bootstrap.js; then fail "Sigue generándose enlace roto de recuperación"; fi
if grep -Fq "/#/verificar-correo?token=" account_security_bootstrap.js; then fail "Sigue generándose enlace roto de verificación"; fi

echo "Password reset/email verification link QA suite OK"
