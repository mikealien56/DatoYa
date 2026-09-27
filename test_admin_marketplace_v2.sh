#!/bin/bash
set -euo pipefail
B=${DATOYA_TEST_BASE:-http://localhost:3000/api}
J='Content-Type: application/json'
COOKIE=/tmp/dy_admin_marketplace_v2_cookie
: "${ADMIN_EMAIL:?ADMIN_EMAIL requerido}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD requerido}"

LOGIN_BODY=$(python3 - <<'PY'
import json, os
print(json.dumps({"email":os.environ["ADMIN_EMAIL"],"password":os.environ["ADMIN_PASSWORD"]}))
PY
)

curl -fsS -c "$COOKIE" -X POST "$B/auth/login" -H "$J" -d "$LOGIN_BODY" |
  python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True'

for endpoint in \
  admin/marketplace-v2/summary \
  admin/marketplace-v2/users \
  admin/marketplace-v2/businesses \
  admin/marketplace-v2/products \
  admin/marketplace-v2/orders \
  admin/marketplace-v2/finance \
  admin/marketplace-v2/impulso \
  admin/marketplace-v2/settings \
  admin/support-cases; do
  code=$(curl -sS -b "$COOKIE" -o /tmp/dy_admin_marketplace_v2_response -w '%{http_code}' "$B/$endpoint")
  if [ "$code" != "200" ]; then
    echo "Admin Marketplace V2 falló /api/$endpoint HTTP $code"
    cat /tmp/dy_admin_marketplace_v2_response
    exit 1
  fi
  python3 -c 'import json; json.load(open("/tmp/dy_admin_marketplace_v2_response"))'
done

curl -fsS -b "$COOKIE" "$B/admin/marketplace-v2/summary" |
  python3 -c 'import sys,json; d=json.load(sys.stdin); s=d.get("summary",{}); assert "users" in s and "businesses_total" in s and "orders" in s'
curl -fsS -b "$COOKIE" "$B/admin/marketplace-v2/settings" |
  python3 -c 'import sys,json; d=json.load(sys.stdin); s=d.get("settings",{}); assert "impulso_monthly_price" in s and "impulso_quarterly_price" in s and "impulso_annual_price" in s'

echo "Admin Marketplace V2 QA OK"
