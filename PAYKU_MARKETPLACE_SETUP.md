# DatoYa — Payku Marketplace (código listo, cobro real cerrado)

## Decisión de producto

- Pagos online: **Payku Marketplace** como proveedor preferido, sujeto a contratación y pruebas.
- Vendedores: registro en DatoYa, formulario bancario en Mi negocio → Pagos, sin pedirles API Keys.
- Compradores: botón Pagar online con Payku en Mis pedidos cuando el vendedor esté habilitado.
- **Comisión DatoYa = 0%**. No añadir 1% o 2% por defecto ni descontar comisiones no pactadas.
- Pagos al retirar, al recibir y transferencia del negocio siguen operativos mientras se habilita Payku.
- Khipu existente no se elimina automáticamente; sigue reservado a sus usos actuales, para no interrumpir pedidos o planes.

## Contrato/API Payku requerido

Payku documenta alta de vendedores `POST /api/maclient`, afiliación
`POST /api/maaffiliation`, checkout `POST /api/transaction` con campo
`marketplace`, consulta `GET /api/transaction/:id` y lista
`GET /api/banks?currency=clp`.

**Necesitamos autorización comercial expresa para usar el reparto 0% DatoYa y
100% vendedor.** La API documenta porcentajes, pero la validez comercial
de ese reparto y el costo del procesador no se prueban sin credenciales y
habilitación de Payku. Si Payku no permite 0/100, no activar cobros; no
deducir silenciosamente comisiones al vendedor.

Fuentes:
- https://docs.payku.com/cl/api/marketplace/
- https://docs.payku.com/cl/api/transaction/
- https://docs.payku.com/cl/api/banks/

## Configuración necesaria SOLO en Render (servidor)

Nunca colocar estos valores en navegador ni GitHub.

```text
PUBLIC_BASE_URL=https://datoya.cl
PAYKU_MARKETPLACE_ENV=sandbox
PAYKU_MARKETPLACE_PUBLIC_TOKEN=<token público de integración Payku del ambiente>
PAYKU_MARKETPLACE_ENCRYPTION_KEY=<clave aleatoria de 32 bytes codificada en base64>
PAYKU_MARKETPLACE_CONTRACT_APPROVED=true
PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED=true
PAYKU_MARKETPLACE_ENABLED=true
PAYKU_MARKETPLACE_LIVE_ALLOWED=false
```

Para producción, después de aprobar el checkout, notificaciones, costos,
verificación bancaria, conciliación y devoluciones en sandbox:
`PAYKU_MARKETPLACE_ENV=production` y
`PAYKU_MARKETPLACE_LIVE_ALLOWED=true` con credenciales de producción.

**El código exige todas las banderas para habilitar Payku.** Si faltan,
los vendedores ven que está en preparación, sin formulario bancario activo;
clientes mantienen métodos directos. Los pagos reales quedan bloqueados.

La clave de cifrado debe mantenerse estable y protegida en Render; rotarla
sin migrar tokens cifrados dejará de funcionar. No enviar claves a terceros.

## Seguridad y operación

- DatoYa NO guarda el número bancario completo ni el RUT recibido durante el
  alta, solo código banco, tipo y últimos cuatro dígitos; Payku recibe la
  información por HTTPS.
- Tokens de afiliación se almacenan cifrados AES-256-GCM vinculados al ID del
  negocio.
- Se reserva el intento de checkout ANTES de enviar la solicitud a Payku.
  Ante timeout, estado `needs_review` y **nunca reintento automático**.
- Notificaciones y retorno del navegador NO acreditan pagos: el servidor
  consulta Payku y valida ID de transacción, referencia y monto exactos.
- El comercio no puede marcar manualmente como pagado un pedido con intento
  Payku. Los pagos directos sin Payku siguen con confirmación manual.
- Un intento rechazado requiere conciliación para volver a cobrar; faltan
  confirmar políticas de expiración/reintentos con Payku.
- En cualquier devolución de fondos de pago Payku se debe verificar primero
  la operación y políticas de reversa del proveedor. La ruta de reembolso de
  DatoYa debe validarse antes del lanzamiento real.
- Panel Admin: `GET /api/admin/payku/marketplace/status` (sin secretos).

## QA automatizada

`node test_payku_marketplace.js` verifica (con respuestas simuladas,
sin mover dinero): desactivación por defecto, alta, afiliación 0/100,
checkout, enlaces seguros, importe/referencia exacta, estados rechazados
y cifrado.

Las pruebas completas del proyecto incluyen registro, pedidos,
stock, retiro/despacho QR y protección contra cancelaciones.

## Pendiente de validación externa

1. Payku habilita Marketplace para DatoYa y acepta explicitamente 0/100.
2. Se obtienen las credenciales y tarifas reales, además de requisitos KYC
   que cada negocio debe completar.
3. Se prueba una afiliación y un pago sandbox con cuenta Payku real.
4. Se prueban rechazo, webhook, reversa/devolución, conciliación y plazos.
5. Solo entonces activar los cobros reales. No prometer pagos automáticos
   ni comisión neta cero antes de que estos puntos estén aprobados.
