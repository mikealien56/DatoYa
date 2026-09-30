#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "UI NAVIGATION QA FAIL: $1"; exit 1; }

node --check business_hub_ui.js
node --check marketplace_weekly_ui.js
node --check marketplace_account_ui.js
node --check marketplace_business_ui.js
node --check support_center_ui.js
node --check marketplace_admin_v2_ui.js

# Panel Negocio: cada acceso debe llevar a su sección real.
grep -Fq "paid?'#/impulso-ahora/'+id:'#/mi-negocio-plan/'+id" business_hub_ui.js || fail "Impulso bloqueado no redirige a Plan"
grep -q "Vista pública" business_hub_ui.js || fail "Falta nombre claro para la vista pública"
grep -q "Datos del negocio" business_hub_ui.js || fail "Negocio no publicado no redirige a sus datos"
grep -Fq "b.status==='active'&&b.slug" business_hub_ui.js || fail "Se ofrece vista pública a negocios no publicados"
grep -q "Cuenta y negocios" business_hub_ui.js || fail "El acceso de cuenta/selector tiene texto ambiguo"
if grep -q "Operativo en TEST" business_hub_ui.js; then fail "El dashboard vuelve a exponer lenguaje TEST"; fi
grep -q "Configurado · activación pendiente" business_hub_ui.js || fail "Estado Khipu no es claro para el negocio"

# Publicación: no ofrecer enlaces públicos imposibles.
grep -Fq "businessPublic=cache?.business?.status==='active'&&!!slug" marketplace_business_ui.js || fail "Productos permiten Ver publicado antes de publicar el negocio"

# Impulso de la semana: siempre vuelve al área comercial, no al perfil.
if grep -q 'href="#/perfil"' marketplace_weekly_ui.js; then fail "Impulso de la semana todavía vuelve a Perfil"; fi
if grep -q "location.hash='#/perfil'" marketplace_weekly_ui.js; then fail "Impulso de la semana todavía termina en Perfil"; fi
grep -Fq "#/mi-negocio-promociones/" marketplace_weekly_ui.js || fail "Impulso de la semana no vuelve a Promociones"
grep -q "weeklyStatusLabel" marketplace_weekly_ui.js || fail "Estados de Impulso semanal siguen sin traducir"
grep -q "Envía tu oferta para revisión" marketplace_weekly_ui.js || fail "Texto principal de Impulso semanal no está corregido"
grep -q "Descripción corta" marketplace_weekly_ui.js || fail "Texto de descripción sin corrección"
grep -q "¿Qué pasa después?" marketplace_weekly_ui.js || fail "Texto de pasos sin corrección"

# Soporte: las cuentas Negocio usan su historial privado.
grep -Fq "location.hash='#/mi-negocio-soporte/'+Number(selected.id)" support_center_ui.js || fail "Soporte superior de Negocio no abre su panel privado"
grep -q "businessPanel" support_center_ui.js || fail "Footer público de soporte puede duplicarse dentro del Panel Negocio"

# Mi DatoYa: estados del negocio en español.
grep -Fq "active:'Activo'" marketplace_account_ui.js || fail "Estado active vuelve a mostrarse en inglés"
grep -Fq "paused:'Pausado'" marketplace_account_ui.js || fail "Estado paused vuelve a mostrarse en inglés"
grep -Fq "rejected:'Rechazado'" marketplace_account_ui.js || fail "Estado rejected vuelve a mostrarse en inglés"
grep -Fq "suspended:'Suspendido'" marketplace_account_ui.js || fail "Estado suspended vuelve a mostrarse en inglés"

# Nomenclatura única.
grep -q "Impulso de la semana" business_hub_ui.js || fail "Panel Negocio usa un nombre distinto para Impulso de la semana"
grep -q "Impulso de la semana" marketplace_admin_v2_ui.js || fail "Admin usa un nombre distinto para Impulso de la semana"

# Márgenes móviles: #view define el gutter y las páginas no lo duplican.
grep -q "DATOYA MOBILE GUTTER CONSISTENCY V1" mobile_app_layout.css || fail "Falta normalización final de márgenes móviles"
grep -q "datoya-shell-v94" service-worker.js || fail "PWA no refresca la auditoría UI"

# Rutas críticas enlazadas desde el Panel Negocio deben existir.
grep -q "routes\['mi-negocio-productos'\]" business_hub_ui.js || fail "Falta ruta Productos"
grep -q "routes\['mi-negocio-pagos'\]" business_hub_ui.js || fail "Falta ruta Pagos"
grep -q "routes\['mi-negocio-promociones'\]" business_hub_ui.js || fail "Falta ruta Promociones"
grep -q "routes\['mi-negocio-estadisticas'\]" business_hub_ui.js || fail "Falta ruta Estadísticas"
grep -q "routes\['mi-negocio-horarios'\]" marketplace_hours_ui.js || fail "Falta ruta Horarios"
grep -q "routes\['mi-negocio-cupones'\]" marketplace_coupons_ui.js || fail "Falta ruta Cupones"
grep -q "routes\['mi-negocio-soporte'\]" business_support_ui.js || fail "Falta ruta Soporte Negocio"
grep -q "routes\['mi-negocio-plan'\]" business_impulse_plan_ui.js || fail "Falta ruta Plan"

echo "UI navigation/consistency QA suite OK"
