#!/usr/bin/env bash
set -euo pipefail
BASE="${DATOYA_TEST_BASE_URL:-http://localhost:3000}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
: "${ADMIN_EMAIL:?}" "${ADMIN_PASSWORD:?}"
curl -fsS -c "$TMP/admin" -H 'Content-Type: application/json' -X POST "$BASE/api/auth/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null
BIZ="$(curl -fsS -b "$TMP/admin" "$BASE/api/admin/marketplace-v2/businesses" | python3 -c 'import json,sys;print(next(b["id"] for b in json.load(sys.stdin)["businesses"] if b["status"]=="active"))')"
ZONE="$(node -e 'console.log(require("./db").db.prepare("SELECT comuna_id FROM businesses WHERE id=?").get(Number(process.argv[1])).comuna_id)' "$BIZ")"
code="$(curl -s -o "$TMP/noauth" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/api/businesses/$BIZ/featured-week/checkout" -d '{}')"
[ "$code" = 401 ] || { echo 'Featured checkout allowed without auth'; exit 1; }
curl -fsS "$BASE/api/featured-business/active?comuna_id=$ZONE" | python3 -c 'import json,sys;assert json.load(sys.stdin)["business"] is None'
ID="$(curl -fsS -b "$TMP/admin" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/featured-business/gift" -d "{\"business_id\":$BIZ}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
curl -fsS "$BASE/api/featured-business/active?comuna_id=$ZONE" | python3 -c 'import json,sys;assert json.load(sys.stdin)["business"] is None'
curl -fsS -b "$TMP/admin" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/featured-business/$ID/activate" -d '{}' >/dev/null
curl -fsS "$BASE/api/featured-business/active?comuna_id=$ZONE" | python3 -c "import json,sys;assert int(json.load(sys.stdin)['business']['id'])==$BIZ"
SECOND="$(curl -fsS -b "$TMP/admin" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/featured-business/gift" -d "{\"business_id\":$BIZ}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
code="$(curl -s -o "$TMP/clash" -w '%{http_code}' -b "$TMP/admin" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/featured-business/$SECOND/activate" -d '{}')"
[ "$code" = 409 ] || { echo 'Featured slot overlap was accepted'; exit 1; }
node - "$ID" <<'NODE'
const db=require('./db').db,id=Number(process.argv[2]);db.prepare('UPDATE featured_business_placements SET ends_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),id);
NODE
curl -fsS "$BASE/api/featured-business/active?comuna_id=$ZONE" | python3 -c 'import json,sys;assert json.load(sys.stdin)["business"] is None'
echo 'Featured business flow OK: auth, review, one slot per zone, expiry'
