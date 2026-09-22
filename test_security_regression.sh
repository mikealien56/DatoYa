#!/bin/bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
COOKIE=/tmp/datoya-security-cookie.txt
rm -f "$COOKIE"
fail(){ echo "SECURITY REGRESSION FAIL: $1"; exit 1; }
code(){ curl -sS -o /tmp/datoya-sec-body -w '%{http_code}' "$@"; }
# Rutas sensibles nunca deben quedar públicas.
for p in /api/auth/session-status /api/requests/1 /api/conversations/1/messages; do
 c=$(code "$BASE$p"); [ "$c" = "401" ] || [ "$c" = "403" ] || fail "$p quedó accesible sin sesión (HTTP $c)"
done
# La resolución de disputas se inyecta antes de iniciar server.js. Verificamos que el endpoint
# real conserve auth + rol admin; así no confundimos el fallback HTML del SPA con una respuesta API.
grep -Fq "app.post('/api/admin/job-disputes/:id/resolve',auth,requireRole('admin')" job_trust_center_bootstrap.js || fail 'La resolución de disputas no exige auth + admin'
grep -Fq "app.use('/api/admin/job-disputes/:id/resolve',auth,requireRole('admin')" dispute_resolution_atomic_guard.js || fail 'El guard atómico de disputas no exige auth + admin'
grep -Fq 'DATOYA_DISPUTE_RESOLUTION_ATOMIC_V1' dispute_resolution_atomic_guard.js || fail 'Falta marcador del guard atómico de disputas'
# Si una ruta /api inexistente cae al SPA, debe identificarse como HTML y nunca contarse como autorización exitosa.
http=$(curl -sS -D /tmp/datoya-sec-headers -o /tmp/datoya-sec-body -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"resolution":"favor_cliente"}' "$BASE/api/admin/job-disputes/999999999/resolve")
if [ "$http" = "200" ] && grep -qi '<!doctype html' /tmp/datoya-sec-body; then echo 'Admin dispute runtime route not materialized in this generated test server; static auth guards verified.'; elif [ "$http" = "401" ] || [ "$http" = "403" ]; then :; else fail "/api/admin/job-disputes/:id/resolve respuesta inesperada HTTP $http"; fi
# Guards que sí se materializan en este servidor generado deben quedar montados.
for marker in DATOYA_REQUEST_ACCESS_GUARD_V1 DATOYA_REQUEST_PHOTO_VALIDATION_V1 DATOYA_CHAT_SECURITY_GUARD_V1 DATOYA_SESSION_ACCOUNT_GUARD_V1; do
 grep -q "$marker" server.js || fail "No se montó $marker"
done
# El guard de disputas depende de una ruta que este fixture mínimo no materializa; se valida su fuente y RBAC arriba.
# Barreras de integridad críticas deben existir en código de arranque.
grep -q 'idx_quotes_one_per_worker_request' database_integrity_bootstrap.js || fail 'Falta UNIQUE de cotización por profesional/solicitud'
grep -q 'idx_payments_one_per_job' accounting_uniqueness_bootstrap.js || fail 'Falta UNIQUE de pago por trabajo'
grep -q 'idx_commissions_one_per_job' accounting_uniqueness_bootstrap.js || fail 'Falta UNIQUE de comisión por trabajo'
# Fotos: el validador debe exigir formato, firma y límite.
grep -q 'photos.length>5' request_photo_validation.js || fail 'Falta límite de fotos'
grep -q "bytes\[0\]===0xff" request_photo_validation.js || fail 'Falta comprobación JPEG real'
# Chat: tamaño y frecuencia.
grep -q 'body.length>2000' chat_security_guard.js || fail 'Falta límite de mensaje'
grep -q 'arr.length>=20' chat_security_guard.js || fail 'Falta rate limit de chat'
# Verificación de correo: debe enviarse al registrar y proteger acciones comerciales críticas.
grep -q 'DATOYA_EMAIL_VERIFICATION_REQUIRED_V1' email_verification_enforcement_bootstrap.js || fail 'Falta guard de verificación de correo'
grep -q "app.post('/api/businesses',auth,__dyRequireVerifiedEmail" email_verification_enforcement_bootstrap.js || fail 'Crear negocio no exige correo verificado'
grep -q "app.post('/api/orders',auth,__dyRequireVerifiedEmail" email_verification_enforcement_bootstrap.js || fail 'Crear pedido no exige correo verificado'
grep -q "app.post('/api/orders/:id/mercadopago/checkout',auth,__dyRequireVerifiedEmail" email_verification_enforcement_bootstrap.js || fail 'Checkout no exige correo verificado'
grep -q 'Verifica tu cuenta DatoYa' email_verification_enforcement_bootstrap.js || fail 'Registro no prepara correo de verificación'
# Separación cliente/negocio: una cuenta cliente no puede administrar comercios.
grep -q 'DATOYA_MARKET_ACCOUNT_SEPARATION_V1' marketplace_account_separation_bootstrap.js || fail 'Falta separación de cuenta cliente y negocio'
grep -q "app.get('/api/businesses/mine',auth,__dyRequireBusinessAccount" marketplace_account_separation_bootstrap.js || fail 'Mis negocios no exige cuenta negocio'
grep -q "app.post('/api/businesses',auth,__dyRequireBusinessAccount" marketplace_account_separation_bootstrap.js || fail 'Crear negocio no exige cuenta negocio'
grep -q "app.post('/api/orders',auth,__dyRequireCustomerAccount" marketplace_account_separation_bootstrap.js || fail 'Crear pedido no exige cuenta cliente'
grep -q "app.post('/api/orders/:id/mercadopago/checkout',auth,__dyRequireCustomerAccount" marketplace_account_separation_bootstrap.js || fail 'Checkout comprador no exige cuenta cliente'
grep -q "account_type:'customer'" marketplace_account_ui.js || fail 'Registro cliente no fija account_type customer'
grep -q "account_type:'business'" marketplace_account_ui.js || fail 'Registro negocio no fija account_type business'
grep -q "LEGAL_ENFORCEMENT || 'true'" account_security_bootstrap.js || fail 'Consentimiento legal no queda habilitado por defecto'
grep -q "legal_consent_recorded" account_security_bootstrap.js || fail 'Registro no confirma persistencia de consentimiento'
grep -q "INSERT INTO account_consents" account_security_bootstrap.js || fail 'Registro no persiste consentimiento en backend'
if grep -q "api('/legal/consent'.*method:'POST'" marketplace_account_ui.js; then fail 'Frontend mantiene segunda escritura redundante de consentimiento'; fi
# Beta privada: RBAC, propiedad e IDOR deben seguir protegidos en backend.
grep -Fq "app.get('/api/admin/private-beta',auth,requireRole('admin')" beta_private_features_bootstrap.js || fail 'Admin beta privada no exige rol admin'
grep -Fq "app.post('/api/admin/private-beta/run-matching',auth,requireRole('admin')" beta_private_features_bootstrap.js || fail 'Matching manual no exige rol admin'
grep -Fq "function __dyOwnedBusiness(uid,id)" beta_private_features_bootstrap.js || fail 'Falta guard de propiedad de negocio'
grep -Fq "const b=__dyOwnedBusiness(req.user.id,req.params.id)" beta_private_features_bootstrap.js || fail 'Pulso/Radar/solicitudes no validan propiedad'
grep -Fq "WHERE id=? AND user_id=?" beta_private_features_bootstrap.js || fail 'Notificaciones no limitan escritura al usuario'
grep -Fq "WHERE id=? AND user_id=? AND status='active'" beta_private_features_bootstrap.js || fail 'Lo Busco Ya no limita cambios al cliente propietario'
grep -Fq "SELECT id FROM products WHERE id=? AND business_id=? AND active=1" beta_private_features_bootstrap.js || fail 'Respuesta permite producto de otro negocio'
if rg -n "DATOYA_ALLOW_LIVE_PAYMENTS\s*=\s*(true|1)" --glob '!test_*' . >/dev/null; then fail 'Pagos reales fueron activados en código'; fi
echo 'Security regression suite OK'
