# DatoYa: Payku Marketplace + Mall — tarifa del cliente 2%

## Modelo comercial adoptado

- **DatoYa cobra una tarifa de servicio del 2% sobre el subtotal de productos** cuando el cliente elige pagar online mediante Payku.
- El cliente paga los productos, el despacho si corresponde y **ese 2% adicional**, en una sola operación.
- El negocio no paga comisión DatoYa por pedido y tiene asignado el importe base de productos más despacho.
- El 2% de DatoYa y el importe del negocio son importes distintos. **La tarifa que cobra Payku por procesar el pago es adicional y puede reducir el depósito según su contrato.**
- Pago al retirar, al recibir y transferencia directa al negocio **no llevan la tarifa de DatoYa del 2%** en esta integración.

Ejemplo: productos CLP 20.000, despacho CLP 1.500, tarifa DatoYa CLP 400; **cliente paga CLP 21.900**. Se envían a Payku asignaciones separadas por **CLP 21.500 al negocio** y **CLP 400 a DatoYa**, sin incluir aún eventuales comisiones del procesador ni obligaciones tributarias.

## ¿Por qué usar dos API del mismo proveedor?

Payku **Marketplace** registra beneficiarios (comercios) y permite crear afiliaciones con distribución por porcentaje. Para el registro base seguimos utilizando afiliación **0% DatoYa / 100% vendedor**, sujeta a autorización del proveedor.

Payku **Mall** permite construir una sola orden de pago con importes concretos para múltiples destinatarios:
- primera parte con ID de afiliación Marketplace del comercio e importe base de venta;
- segunda parte con token público de DatoYa e importe exacto de tarifa de servicio.

**La documentación describe ambas funciones, pero no demuestra que Payku habilite su combinación para la misma cuenta, ni quién asume la tarifa de procesamiento.** No activar cobros reales hasta confirmarlo contractual y operativamente. No sustituir Mall por un porcentaje fijo que altere el importe del vendedor.

Documentación oficial:
- https://docs.payku.com/cl/api/marketplace/
- https://docs.payku.com/cl/api/mall/
- https://docs.payku.com/cl/signature/

## Activación (solo backend de Render)

Las siguientes variables son condiciones de activación, no credenciales para enviar en correos públicos ni para incluir en la web o repositorio:

```text
PUBLIC_BASE_URL=https://datoya.cl
PAYKU_MARKETPLACE_ENV=sandbox
PAYKU_MARKETPLACE_PUBLIC_TOKEN=<token público del servidor Payku>
PAYKU_MARKETPLACE_PRIVATE_TOKEN=<token PRIVADO para firma HMAC, solo backend>
PAYKU_MARKETPLACE_ENCRYPTION_KEY=<32 bytes aleatorios base64, mantener estable>
PAYKU_MARKETPLACE_CONTRACT_APPROVED=true
PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED=true
PAYKU_MALL_SERVICE_FEE_APPROVED=true
PAYKU_MARKETPLACE_ENABLED=true
PAYKU_MARKETPLACE_LIVE_ALLOWED=false
```

Las banderas de aprobación **solo se activan después de que el proveedor confirme explícitamente las condiciones** y se pruebe un pago en su sandbox. Las condiciones `CONTRACT_APPROVED`, `ZERO_SPLIT_APPROVED` y `MALL_SERVICE_FEE_APPROVED` deben reflejar hechos comprobados, nunca sustituirlos.

Para producción (tras sandbox, conciliación, tarifas, reembolsos y KYC), cambiar `PAYKU_MARKETPLACE_ENV=production` y `PAYKU_MARKETPLACE_LIVE_ALLOWED=true` **solo con aprobación y credenciales productivas**.

### Comportamiento seguro antes de la habilitación

Si falta cualquiera de las autorizaciones o credenciales requeridas, **Payku Mall no aparece como método de pago activo**. Los pagos al retirar, al recibir y por transferencia siguen disponibles. No se muestra ni cobra el 2% en los métodos de pago directo.

El panel del vendedor le permite cargar sus datos para onboarding únicamente cuando el componente Marketplace está habilitado. Si la cuenta está registrada pero pendiente de activación por Payku, no se habilita cobro online en producción.

## Implementación técnica

- `datoya_service_fee.js`: cálculo entero CLP; 2% de productos, sin recargar despacho; total exacto validado desde el pedido almacenado.
- `payku_marketplace_service.js`: alta vendedor, firma HMAC SHA-256 de Mall, creación de orden de pago con dos asignaciones, recuperación y validación de resultado.
- `payku_marketplace_routes.js`: alta, cotización visible al comprador, checkout, verificación, notificaciones y diagnóstico administrativo.
- `payku_marketplace_bootstrap.js`: esquema y protecciones contra marcar pagado / cancelar pedidos con intentos Payku.
- `payku_marketplace_ui.js`: resumen con productos, despacho, tarifa 2% y total visible antes de redirigir a Payku.

Las credenciales del vendedor no van al navegador ni deben entregarse al usuario. El token de afiliación se cifra AES-256-GCM asociado al ID del negocio. Se almacena para cada intento de cobro la **tarifa 2% y la asignación del vendedor** para reconciliar el importe correcto.

La redirección del navegador ni las notificaciones de Payku acreditan automáticamente el pedido: el servidor consulta la operación a Payku, compara ID, importe total y los dos importes individuales. Ante timeout o diferencias se bloquea y requiere revisión manual para evitar duplicados.

## Falta antes de dinero real

1. Confirmar contractualmente con Payku Marketplace + Mall en **una sola cuenta**, dos destinatarios, cargos de procesamiento y liquidación al comercio.
2. Activar cuenta y obtener tokens de sandbox, probar alta, revisión y afiliación KYC reales.
3. Probar Mall en sandbox con 2%: autorización, anulación, pago rechazado, montos discrepantes, callback y reembolso completo/parcial.
4. Confirmar facturación, IVA/documentación del cargo de servicio al cliente y procedimientos de soporte/reembolsos de la tarifa.
5. Verificar visualmente en móvil y PC; solo después habilitar producción.

**Estado:** implementación técnica en rama GitHub; nada cobrado realmente y no se han cambiado las variables de Render.
