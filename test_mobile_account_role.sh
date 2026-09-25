#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

fail(){ echo "MOBILE ROLE QA FAIL: $1"; exit 1; }

node --check marketplace_commerce_ui.js
node --check marketplace_account_ui.js
node --check marketplace_public_beta_ui.js
node --check beta_private_ui.js

grep -q "const isCustomerAccount" marketplace_commerce_ui.js || fail "Falta clasificación Cliente en comercio"
grep -q "if(ME&&!isCustomerAccount())return" marketplace_commerce_ui.js || fail "Carrito flotante no se oculta para Negocio/Admin"
grep -q "Las compras se realizan con una cuenta Cliente" marketplace_commerce_ui.js || fail "Agregar al carrito no protege cuentas Negocio/Admin"
grep -q "Las compras usan una cuenta Cliente" marketplace_commerce_ui.js || fail "Carrito no explica separación Cliente/Negocio"
grep -q "Mis pedidos pertenece a las cuentas Cliente" marketplace_commerce_ui.js || fail "Ruta Mis pedidos no protege cuentas Negocio/Admin"
grep -q "if(!requireBusinessAccount())return" marketplace_commerce_ui.js || fail "Herramientas de negocio no tienen guard de cuenta"
grep -q "if(!isCustomerAccount())return;const top" marketplace_commerce_ui.js || fail "Perfil Negocio todavía puede recibir botón Mis pedidos"
grep -q "datoya_after_auth','#/carrito" marketplace_commerce_ui.js || fail "Login desde carrito no recuerda el carrito"
grep -q "datoya_after_auth','#/pedidos" marketplace_commerce_ui.js || fail "Login desde pedidos no recuerda pedidos"
grep -q "rawNext.startsWith('#/')" marketplace_account_ui.js || fail "Login no restaura una ruta interna segura"
grep -q "sessionStorage.setItem('datoya_after_auth',location.hash" marketplace_public_beta_ui.js || fail "Favoritos/seguidos no recuerdan la ficha tras login"
grep -q "sessionStorage.setItem('datoya_after_auth',location.hash" beta_private_ui.js || fail "Alertas/Lo Busco Ya no recuerdan la ruta tras login"
grep -q "data-product-id=\"\${Number(p.id)}\"" marketplace_public_beta_ui.js || fail "Ficha pública no identifica productos por ID"
grep -q "data-product-id=\"\${Number(p.id)}\"" marketplace_growth_ui.js || fail "Ficha growth no identifica productos por ID"
grep -q "productById=new Map" marketplace_commerce_ui.js || fail "Carrito sigue dependiendo del orden visual de productos"
grep -q "el.dataset.productId" marketplace_commerce_ui.js || fail "Carrito no enlaza botón con ID de producto"
grep -q "datoya-shell-v65" service-worker.js || fail "PWA no refresca caché para correcciones móviles"
grep -q "data-signup-hour-day" marketplace_account_ui.js || fail "Registro no muestra horarios semanales"
grep -q "accept_orders_when_closed" marketplace_account_ui.js || fail "Registro no permite definir pedidos fuera de horario"
grep -q "hours_schedule" marketplace_account_bootstrap_v2.js || fail "Registro no persiste horarios estructurados"
grep -q "Configura al menos un día de atención" marketplace_account_bootstrap_v2.js || fail "Backend no valida horario inicial"
grep -q "mi-negocio-horarios" business_hub_ui.js || fail "Panel Negocio no expone editor de horarios"
grep -q "dy-hours-weekdays-default" marketplace_hours_ui.js || fail "Editor de horarios no tiene atajo Lun–Vie"

grep -q "if(categoryBoxes.length)draft.category_ids" marketplace_account_ui.js || fail "El paso final del registro borra categorías elegidas"


grep -q "\['Mis pedidos','#/pedidos'" marketplace_topnav_fix.js || fail "Cliente no tiene acceso directo a Mis pedidos"
grep -q 'data-nav="pedidos"' marketplace_topnav_fix.js || fail "Barra móvil Cliente no incluye Pedidos"
grep -q "dy-order-progress" marketplace_commerce_ui.js || fail "Mis pedidos no muestra progreso del pedido"
grep -q "dy-order-focus" marketplace_commerce_ui.js || fail "Notificación no puede destacar el pedido exacto"
grep -q "'#/pedidos/'+o.id" marketplace_commerce_bootstrap.js || fail "Cambio de estado no enlaza al pedido exacto"
grep -q "Pago registrado para tu pedido" marketplace_commerce_bootstrap.js || fail "Pago manual no notifica al Cliente"


echo "Mobile account-role QA suite OK"
