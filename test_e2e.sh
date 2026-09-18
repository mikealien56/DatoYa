#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== DatoYa E2E oficial: marketplace comercial ==="
echo "Este test ya no valida trabajadores, solicitudes ni cotizaciones legacy."

for f in marketplace_account_bootstrap_v2.js marketplace_products_bootstrap.js marketplace_commerce_bootstrap.js marketplace_payments_bootstrap.js marketplace_growth_bootstrap.js marketplace_hours_bootstrap.js; do
  node --check "$f" >/dev/null
done

bash test_marketplace_payment.sh

echo ""
echo "✅ DatoYa E2E marketplace: cuenta → negocio → aprobación → horarios → producto → privacidad → Fundador → QR → analítica → Impulso Ahora → pedido → stock → Mercado Pago TEST"
