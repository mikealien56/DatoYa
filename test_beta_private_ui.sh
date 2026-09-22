#!/usr/bin/env bash
set -euo pipefail
node --check beta_private_ui.js
node --check beta_private_assets.js
grep -q "beta_private_assets" production_start.js
grep -q "routes\['mi-negocio-pulso'\]" beta_private_ui.js
grep -q "routes\['mi-negocio-radar'\]" beta_private_ui.js
grep -q "routes.alertas" beta_private_ui.js
grep -q "routes\['lo-busco-ya'\]" beta_private_ui.js
grep -q "routes\['mi-negocio-lo-busco-ya'\]" beta_private_ui.js || { echo "Falta Lo Busco Ya en Panel Negocio"; exit 1; }
grep -q "data-wanted-response" beta_private_ui.js || { echo "Falta formulario de respuesta Lo Busco Ya"; exit 1; }
grep -q "Lo Busco Ya" business_hub_ui.js || { echo "Falta Lo Busco Ya en navegación del negocio"; exit 1; }
grep -q "__datoyaBusinessHubFrame" business_hub_ui.js || { echo "Falta marco unificado para funciones beta de negocio"; exit 1; }
grep -q "dy-notification-bell" beta_private_ui.js
grep -q "if(bellRefresh)return bellRefresh" beta_private_ui.js
grep -q "querySelectorAll('#dy-notification-bell')" beta_private_ui.js
grep -q "routes.favoritos" beta_private_ui.js
grep -q "trackSearch" marketplace_public_beta_ui.js || { echo "La búsqueda pública no registra demanda"; exit 1; }
grep -q "market/search-events" marketplace_public_beta_ui.js || { echo "La búsqueda no llama al registro de demanda"; exit 1; }
grep -q "matchingBusinessIds.size+matchingProducts.length" marketplace_public_beta_ui.js || { echo "Las categorías no registran demanda local"; exit 1; }
grep -q "admin/private-beta" beta_private_ui.js
grep -q "Pulso Local" business_hub_ui.js
grep -q "Radar" business_hub_ui.js
echo "Beta privada UI: validaciones correctas"
