#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

node --check service-worker.js
grep -q "datoya-shell-v40" service-worker.js
grep -q "url.pathname.startsWith('/api/')" service-worker.js
grep -q "event.respondWith(fetch(event.request))" service-worker.js
grep -q "response.ok&&!response.redirected" service-worker.js
for asset in beta_private_ui.js beta_private_ui.css business_hub_ui.js business_hub.css marketplace_admin_v2_ui.js marketplace_admin_v2.css; do
  grep -q "'/$asset'" service-worker.js || { echo "Falta asset PWA actual: $asset"; exit 1; }
done
grep -q '"display": "standalone"' manifest.webmanifest
grep -q '"purpose":"maskable"' manifest.webmanifest
echo 'PWA cache/security suite OK'
