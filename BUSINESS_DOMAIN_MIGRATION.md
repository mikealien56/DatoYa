# Migración al dominio comercial real

## Migrado

- Home conectado a negocios y categorías reales, sin tarjetas inventadas.
- `businesses`, `business_categories`, `products`, `business_images`, `business_hours`.
- Roles aditivos `user`, `merchant`, `admin` mediante `user_roles`.
- GPS, radios 1/3/5/10 km, búsqueda por negocio/producto/categoría y orden por distancia.
- Privacidad de `home_business`: dirección y coordenadas no salen en API pública si `show_exact_address=0`.
- Registro inicial, borrador, revisión, perfil público, dashboard y moderación administrativa.

## Legacy temporal

- `worker_profiles`, `worker_categories`, `worker_comunas`, `portfolio_images`.
- `service_requests`, `quotes`, `jobs`, conversaciones y pagos DEMO.
- Rol antiguo `cliente/trabajador/admin` en `users.role`.
- Suscripciones `PRO`, verificaciones y favoritos de trabajadores.

Estas estructuras permanecen para no romper cuentas, expedientes, cotizaciones ni el panel anterior. Ningún registro comercial nuevo crea un `worker_profile`.

## Pendiente

- Promociones e Impulso Ahora con sus reglas completas de ventana horaria y stock.
- Pedidos comerciales, clientes, analítica avanzada y carga real de imágenes.
- Migración asistida de perfiles legacy que correspondan a negocios.
- Retirada final de pantallas y endpoints de trabajadores después de auditar datos de producción.
- Pagos reales, courier, multi-carrito, billetera, DatoYa Alerta y Pulso Local.
