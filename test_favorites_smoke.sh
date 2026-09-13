#!/bin/bash
set -euo pipefail
B=http://localhost:3000/api
J='Content-Type: application/json'
COOKIE=/tmp/dy_favorites_smoke
EMAIL='favorites-smoke@datoya.test'

curl -fsS -c "$COOKIE" -X POST "$B/auth/register" -H "$J" -d "{\"name\":\"Cliente Favoritos\",\"email\":\"$EMAIL\",\"password\":\"test1234\",\"role\":\"cliente\",\"comuna_id\":4}" | grep -q '"ok":true'

curl -fsS -b "$COOKIE" "$B/favorites" | grep -q '"favorites":\[\]'
curl -fsS -b "$COOKIE" -X POST "$B/favorites/1" -H "$J" -d '{}' | grep -q '"favorite":true'
curl -fsS -b "$COOKIE" "$B/favorites" | grep -q '1'
curl -fsS -b "$COOKIE" -X POST "$B/favorites/1" -H "$J" -d '{}' | grep -q '"favorite":false'
curl -fsS -b "$COOKIE" "$B/favorites" | grep -q '"favorites":\[\]'

echo "Favoritos API smoke OK"
