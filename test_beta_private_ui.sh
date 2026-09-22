#!/usr/bin/env bash
set -euo pipefail
node --check beta_private_ui.js
node --check beta_private_assets.js
grep -q "beta_private_assets" production_start.js
grep -q "routes\['mi-negocio-pulso'\]" beta_private_ui.js
grep -q "routes\['mi-negocio-radar'\]" beta_private_ui.js
grep -q "routes.alertas" beta_private_ui.js
grep -q "category_id" beta_private_ui.js || { echo "DatoYa Alerta no permite categoría"; exit 1; }
grep -q "datoya_lat" beta_private_ui.js || { echo "DatoYa Alerta no usa ubicación guardada"; exit 1; }
grep -q "match.source_type" beta_private_ui.js || { echo "DatoYa Alerta no muestra origen de coincidencia"; exit 1; }
grep -q "Avísame cuando aparezca" beta_private_ui.js || { echo "Búsqueda no ofrece crear alerta contextual"; exit 1; }
grep -q "routes\['lo-busco-ya'\]" beta_private_ui.js
grep -q "routes\['mi-negocio-lo-busco-ya'\]" beta_private_ui.js || { echo "Falta Lo Busco Ya en Panel Negocio"; exit 1; }
grep -q "data-wanted-response" beta_private_ui.js || { echo "Falta formulario de respuesta Lo Busco Ya"; exit 1; }
grep -q "Lo Busco Ya" business_hub_ui.js || { echo "Falta Lo Busco Ya en navegación del negocio"; exit 1; }
grep -q "__datoyaBusinessHubFrame" business_hub_ui.js || { echo "Falta marco unificado para funciones beta de negocio"; exit 1; }
grep -q "dy-notification-bell" beta_private_ui.js
grep -q "if(bellRefresh)return bellRefresh" beta_private_ui.js
grep -q "querySelectorAll('#dy-notification-bell')" beta_private_ui.js
grep -q "Notification.requestPermission" beta_private_ui.js || { echo "Centro de notificaciones no solicita permiso Push de forma explícita"; exit 1; }
grep -q "pushManager.subscribe" beta_private_ui.js || { echo "Falta suscripción Push del navegador"; exit 1; }
grep -q "api('/push/subscribe'" beta_private_ui.js || { echo "Suscripción Push no se persiste en DatoYa"; exit 1; }
grep -q "detachPushForLogout" beta_private_ui.js || { echo "Logout no desvincula Push de la cuenta"; exit 1; }
grep -q "api('/push/test'" beta_private_ui.js || { echo "Falta prueba de aviso Push"; exit 1; }
grep -q "routes.favoritos" beta_private_ui.js
grep -q "data-remove-favorite" beta_private_ui.js || { echo "Mis guardados no permite quitar favoritos"; exit 1; }
grep -q "data-toggle-follow-notify" beta_private_ui.js || { echo "Mis guardados no permite controlar avisos"; exit 1; }
grep -q "savedButton" marketplace_public_beta_ui.js || { echo "Faltan corazones en marketplace público"; exit 1; }
grep -q "data-dy-follow" marketplace_public_beta_ui.js || { echo "Falta botón Seguir negocio"; exit 1; }
grep -q "bindSavedActions" marketplace_public_beta_ui.js || { echo "Favoritos visuales no están conectados a API"; exit 1; }
grep -q "trackSearch" marketplace_public_beta_ui.js || { echo "La búsqueda pública no registra demanda"; exit 1; }
grep -q "market/search-events" marketplace_public_beta_ui.js || { echo "La búsqueda no llama al registro de demanda"; exit 1; }
grep -q "matchingBusinessIds.size+matchingProducts.length" marketplace_public_beta_ui.js || { echo "Las categorías no registran demanda local"; exit 1; }
grep -q "admin/private-beta" beta_private_ui.js
grep -q "Pulso Local" business_hub_ui.js
grep -q "Radar" business_hub_ui.js
echo "Beta privada UI: validaciones correctas"
