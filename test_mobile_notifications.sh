#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "MOBILE NOTIFICATIONS QA FAIL: $1"; exit 1; }

node --check beta_private_ui.js
node --check phase_a_assets.js
node --check service-worker.js

grep -q "id=\"dy-push-help\"" beta_private_ui.js || fail "Falta CTA para permisos bloqueados"
grep -q "Notification.permission==='denied'" beta_private_ui.js || fail "Falta manejo explícito de permiso denied"
grep -q "dy-push-retry" beta_private_ui.js || fail "Falta feedback/reintento cuando no se puede comprobar Push"
grep -q "dy-bell-icon" beta_private_ui.js || fail "Campana no usa icono centrable"
grep -q "display:inline-flex" beta_private_ui.css || fail "Campana no usa centrado flex"
grep -q "dy-push-help" beta_private_ui.css || fail "Falta estilo de ayuda Push"
grep -Eq "datoya-shell-v(9[4-9]|[1-9][0-9]{2,})" service-worker.js || fail "Falta refresco de caché PWA"

# Integración Android: la descarga de pruebas debe ser realmente instalable,
# mientras que el release comercial exige una firma de producción independiente.
grep -q "assembleDebug assembleRelease" .github/workflows/android-capacitor.yml || fail "Android no genera APK debug firmada para pruebas"
grep -q "DatoYa-Android-PRUEBAS-debug.apk" .github/workflows/android-capacitor.yml || fail "Falta artefacto APK de pruebas"
grep -q "DATOYA_FIREBASE_GOOGLE_SERVICES_B64" .github/workflows/android-capacitor.yml || fail "El build no usa configuración Firebase privada"
grep -q "datoya-d9669" .github/workflows/android-capacitor.yml || fail "Falta verificación de proyecto Firebase"
grep -q "native_push_tokens" native_push_bootstrap.js || fail "Falta almacenamiento de tokens Android"
grep -q "Probar aviso" beta_private_ui.js || fail "Falta prueba de notificaciones"

node <<'NODE'
const fs=require('fs');
const phase=fs.readFileSync('phase_a_assets.js','utf8');
if(phase.includes("</script>\\\\n';")) throw new Error('phase_a_assets todavía genera un \\n literal');
if(!phase.includes("</script>\\n';")) throw new Error('phase_a_assets no conserva el salto de línea real esperado');
console.log('Literal newline regression OK');
NODE

echo "Mobile notifications QA suite OK"
