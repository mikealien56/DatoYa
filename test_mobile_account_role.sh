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
grep -q "datoya-shell-v62" service-worker.js || fail "PWA no refresca caché para correcciones móviles"

echo "Mobile account-role QA suite OK"
