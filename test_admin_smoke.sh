#!/bin/bash
set -euo pipefail
B=http://localhost:3000/api
J='Content-Type: application/json'
COOKIE=/tmp/dy_admin_smoke

curl -fsS -c "$COOKIE" -X POST "$B/auth/login" -H "$J" -d '{"email":"admin@demo.cl","password":"demo1234"}' | grep -q '"ok":true'

for endpoint in stats users workers categories jobs audit reports settings payouts disputes earnings bank messages subscriptions verification-requests; do
  code=$(curl -s -b "$COOKIE" -o /tmp/dy_admin_response -w '%{http_code}' "$B/admin/$endpoint")
  if [ "$code" != "200" ]; then
    echo "Admin endpoint /api/admin/$endpoint falló (HTTP $code)"
    cat /tmp/dy_admin_response
    exit 1
  fi
done

echo "Admin panel API smoke OK"
