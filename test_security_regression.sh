#!/bin/bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
COOKIE=/tmp/datoya-security-cookie.txt
rm -f "$COOKIE"
fail(){ echo "SECURITY REGRESSION FAIL: $1"; exit 1; }
code(){ curl -sS -o /tmp/datoya-sec-body -w '%{http_code}' "$@"; }
# Rutas sensibles nunca deben quedar públicas.
for p in /api/auth/session-status /api/requests/1 /api/conversations/1/messages /api/admin/job-disputes/1/resolve; do
 c=$(code "$BASE$p"); [ "$c" = "401" ] || [ "$c" = "403" ] || fail "$p quedó accesible sin sesión (HTTP $c)"
done
# Los guards nuevos deben estar realmente montados en el runtime generado.
for marker in DATOYA_REQUEST_ACCESS_GUARD_V1 DATOYA_REQUEST_PHOTO_VALIDATION_V1 DATOYA_CHAT_SECURITY_GUARD_V1 DATOYA_SESSION_ACCOUNT_GUARD_V1 DATOYA_DISPUTE_RESOLUTION_ATOMIC_V1; do
 grep -q "$marker" server.js || fail "No se montó $marker"
done
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
echo 'Security regression suite OK'
