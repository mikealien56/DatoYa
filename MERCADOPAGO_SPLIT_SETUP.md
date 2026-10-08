# DatoYa — Mercado Pago Split de Pagos 1:1 (Chile)

## Estado real
La integración técnica existe en la rama `feature/mp-split-1to1-20261008`, con activación **desactivada de forma predeterminada**. No equivale a tener una cuenta habilitada o dinero real distribuido.

Mercado Pago documenta Split 1:1 para Chile con Checkout Pro y `marketplace_fee`. Para funcionar requiere que la plataforma tenga una **aplicación de Mercado Pago** y cada negocio vincule su propia **cuenta verificada** mediante OAuth. No usar el token de DatoYa para cobrar ventas de otro comerciante.

### Distribución por pedido
El 2% de DatoYa se añade al **subtotal de productos**, no al despacho.
- Productos $20.000, retiro: tarifa $400, **comprador paga $20.400**.
- Productos $20.000, despacho $1.500: tarifa $400, **comprador paga $21.900**.
- Posible venta de prueba con productos de $50: tarifa $1, **comprador pagaría $51**, **si Mercado Pago acepta ese monto mínimo**. No hay garantía de aceptación de ese importe.

Se crea una sola preferencia de checkout **usando el token OAuth del negocio**, con el total completo en CLP y `marketplace_fee=400`. Mercado Pago separa el cobro de la plataforma; **su propia comisión de procesamiento se deduce del importe del vendedor** según sus reglas. La plataforma debe conciliar la comisión realmente acreditada.

La integración no cobra tarifa DatoYa a pagos directos al retirar, entregar ni transferencia bancaria.

## Configuración en la aplicación Mercado Pago y Render

Requiere una cuenta propia apta para vender, verificación de identidad vigente, y acceso autorizado a la función Split 1:1.

En <https://www.mercadopago.cl/developers/panel/app> crea/selecciona una integración para DatoYa con Checkout Pro + Split 1:1, configura su redirect URI EXACTO:

```text
https://www.datoya.cl/api/mp-split/oauth/callback
```

Configura notificaciones Webhooks de pagos a:

```text
https://www.datoya.cl/api/mp-split/webhook
```

La plataforma debe tener acceso a los tokens **APP ID**, **Client Secret**, clave **Webhook secret** y una clave Base64 de 32 bytes para almacenar las credenciales OAuth cifradas.

**Nunca publiques Client Secret, token OAuth, claves ni Webhook secret en GitHub, por chat o en archivos públicos.** Configurar exclusivamente variables de entorno privadas en Render:

```text
PUBLIC_BASE_URL=https://www.datoya.cl
MP_SPLIT_APP_ID=<id numérico de aplicación Mercado Pago>
MP_SPLIT_CLIENT_SECRET=<Client Secret privado>
MP_SPLIT_ENCRYPTION_KEY=<clave AES-256 Base64 aleatoria de 32 bytes; mantener estable>
MP_SPLIT_WEBHOOK_SECRET=<firma secreta Webhooks privada>
MP_SPLIT_MODE=test
MP_SPLIT_ENABLED=true
MP_SPLIT_CHECKOUT_ENABLED=false
MP_SPLIT_LIVE_ALLOWED=false
```

Para probar pagos simulados, utiliza un comercio autorizado con credenciales de prueba, flujo OAuth correcto y comprador de prueba independiente. Cambia `MP_SPLIT_CHECKOUT_ENABLED=true` solo cuando lo demás esté verificado.

**Para pagar dinero real**: debes utilizar la aplicación y la cuenta comercial autorizadas, un negocio verificado y OAuth `live_mode=true`. Después de verificar en ambiente controlado, cambia las banderas a:

```text
MP_SPLIT_MODE=production
MP_SPLIT_CHECKOUT_ENABLED=true
MP_SPLIT_LIVE_ALLOWED=true
```

Esto **sí permite dinero real**: establecer únicamente tras comprobar contrato, cuentas, tarifas, correo/webhook y conciliación en un entorno controlado, con aprobación explícita del responsable de la cuenta.

## Experiencia del negocio
En **Mi negocio → Pagos**, cada comercio autorizado verá un botón para vincular su cuenta Mercado Pago sin compartir contraseñas ni copiar tokens. La conexión OAuth queda cifrada con AES-256-GCM asociado al negocio. La integración refresca el token del comercio si caduca.

## Experiencia del comprador
Para un pedido de negocio con Mercado Pago Split habilitado: en **Mis pedidos**, revisar subtotal + despacho + tarifa DatoYa 2% + total, confirmar y abrir Checkout Pro en el sitio de Mercado Pago. Una vuelta a DatoYa o un parámetro del navegador NO autoriza marcar pagado.

El backend comprueba la preferencia existente y el valor `marketplace_fee`, consulta el pago al proveedor, y valida referencia de pedido, comercio receptor, monto total, moneda y estado. Para webhooks exige firma HMAC correcta.

## Pago de prueba pequeño

No se crea una compra o cargo automáticamente desde el despliegue. El comprador debe iniciar y aprobar el pago desde la interfaz de Mercado Pago.

1. Vincular una cuenta de comercio auténtica y aprobada mediante OAuth.
2. Crear un producto válido y un pedido real en DatoYa. Para $50, el valor del producto sería $50 y el checkout mostraría $51; Mercado Pago **puede rechazar importes pequeños**.
3. Revisar la pantalla del cliente con la tarifa visible y aceptar voluntariamente el pago.
4. Confirmar el importe en Mercado Pago **antes** de autorizar. No compartir datos bancarios ni contraseñas.
5. Verificar en DatoYa que el pedido queda pagado y conciliar **en las cuentas reales de Mercado Pago** cuánto recibió el comercio, cuánto DatoYa y cuánto cobró Mercado Pago de procesamiento.
6. Probar reembolso completo y parcial antes de activar el checkout para público general.

**No marcar completo el paso 5 por pruebas simuladas:** exige evidencia bancaria/contable del abono.

## Seguridad
- Apagado por defecto. Para producción requiere `MP_SPLIT_LIVE_ALLOWED`.
- Estado CSRF OAuth de un solo uso y caducidad corta.
- Token del comerciante cifrado y nunca expuesto al navegador.
- Un intento de checkout por pedido, sin reintento automático si hay timeout.
- Páginas de retorno y webhooks nunca confirman pagos por sí solos.
- Verificación de la operación directamente en la API con el token del comercio.
- Evita que un pedido con intento Payku use también Mercado Pago.
- Pedidos con MP iniciado no se marcan manualmente pagados ni se cancelan sin conciliar.

## Documentación oficial
- <https://www.mercadopago.cl/developers/es/docs/split-payments/split-1-1/prerequisites>
- <https://www.mercadopago.cl/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace>
- <https://www.mercadopago.cl/developers/es/docs/security/oauth/creation>
- <https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro-preferences/overview>
- <https://www.mercadopago.cl/developers/es/docs/split-payments/additional-content/your-integrations/notifications/webhooks>
