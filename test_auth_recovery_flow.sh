#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
PASS_OLD="DatoYa-Recovery-2026!"
PASS_NEW="DatoYa-Recovery-2026-New!"
STAMP="$(date +%s)-$$"
EMAIL="qa-recovery-${STAMP}@datoya.test"
COOKIE="$(mktemp)"
trap 'rm -f "$COOKIE"' EXIT
fail(){ echo "AUTH RECOVERY E2E FAIL: $1"; exit 1; }

COMUNA_ID="$(curl -fsS "$BASE/api/comunas" | python3 -c 'import sys,json; x=json.load(sys.stdin)["comunas"]; assert x; print(x[0]["id"])')"

REGISTER="$(curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/register"   -d "{\"name\":\"Recovery QA\",\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\",\"comuna_id\":$COMUNA_ID,\"role\":\"cliente\",\"account_type\":\"customer\",\"accept_terms\":true,\"accept_privacy\":true}")"
printf '%s' "$REGISTER" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True'

VERIFY_JSON="$(curl -fsS -b "$COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/request" -d '{}')"
VERIFY_TOKEN="$(printf '%s' "$VERIFY_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("test_token") or "")')"
[ -n "$VERIFY_TOKEN" ] || fail "No se obtuvo token TEST de verificación"

CONFIRM="$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/email-verification/confirm" -d "{\"token\":\"$VERIFY_TOKEN\"}")"
VERIFIED_ID="$(printf '%s' "$CONFIRM" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print(d.get("verified_user_id") or "")')"
[ -n "$VERIFIED_ID" ] || fail "Confirmación no devolvió verified_user_id"

curl -fsS -b "$COOKIE" "$BASE/api/auth/security-status" | python3 -c 'import sys,json; assert json.load(sys.stdin).get("email_verified") is True'

FORGOT="$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/forgot-password" -d "{\"email\":\"$EMAIL\"}")"
RESET_TOKEN="$(printf '%s' "$FORGOT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("test_token") or "")')"
[ -n "$RESET_TOKEN" ] || fail "No se obtuvo token TEST de recuperación"

curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/auth/reset-password"   -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"$PASS_NEW\"}" |
  python3 -c 'import sys,json; assert json.load(sys.stdin).get("ok") is True'

CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/auth/me")"
[ "$CODE" = "401" ] || fail "La sesión anterior sobrevivió al cambio de contraseña (HTTP $CODE)"

OLD_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\"}")"
[ "$OLD_CODE" = "401" ] || fail "La contraseña anterior todavía inicia sesión (HTTP $OLD_CODE)"

curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login"   -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_NEW\"}" |
  python3 -c 'import sys,json; assert json.load(sys.stdin).get("ok") is True'
curl -fsS -b "$COOKIE" "$BASE/api/auth/me" | python3 -c 'import sys,json; u=json.load(sys.stdin)["user"]; assert u.get("account_type")=="customer"'

GOOD1="$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://datoya.cl' -H 'Content-Type: application/json' -X POST "$BASE/api/auth/forgot-password" -d '{"email":"nobody@datoya.test"}')"
GOOD2="$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://www.datoya.cl' -H 'Content-Type: application/json' -X POST "$BASE/api/auth/forgot-password" -d '{"email":"nobody@datoya.test"}')"
BAD="$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -X POST "$BASE/api/auth/forgot-password" -d '{"email":"nobody@datoya.test"}')"
[ "$GOOD1" = "200" ] || fail "datoya.cl fue bloqueado por Origin Guard ($GOOD1)"
[ "$GOOD2" = "200" ] || fail "www.datoya.cl fue bloqueado por Origin Guard ($GOOD2)"
[ "$BAD" = "403" ] || fail "Origin Guard aceptó un origen externo ($BAD)"

echo "Auth recovery / verification E2E OK"
