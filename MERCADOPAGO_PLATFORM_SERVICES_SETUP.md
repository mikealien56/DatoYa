# DatoYa · Planes Impulso y DatoYa Club con Mercado Pago

## Estado
Implementado en el código como **Checkout Pro de pago único**. No es una suscripción ni una renovación automática. Está **desactivado de forma predeterminada** y requiere aprobación de la persona adulta autorizada a administrar la cuenta de Mercado Pago antes de habilitar dinero real.

Este circuito es **diferente de Split 1:1**, que procesa ventas entre un comprador y un negocio, separando el cargo de servicio DatoYa. Los servicios propios (pases Club, planes Impulso) se cobran directamente a la cuenta titular de DatoYa, sin utilizar el token OAuth de un negocio.

## Variables de entorno privadas en Render

El titular autorizado debe configurar las credenciales en el servicio de DatoYa, nunca por chat ni en GitHub. No reproducir valores sensibles en capturas.

| Variable | Propósito |
|---|---|
| `MP_PLATFORM_ACCESS_TOKEN` | Token de la cuenta propietaria de DatoYa (test o producción). |
| `MP_PLATFORM_COLLECTOR_ID` | ID numérico del cobrador propio, verificado en el proveedor. |
| `MP_PLATFORM_WEBHOOK_SECRET` | Clave privada de firma del webhook de la aplicación. |
| `MP_PLATFORM_MODE` | `test` o `production`. |
| `MP_PLATFORM_CHECKOUT_ENABLED` | `false` hasta completar pruebas y autorización. |
| `MP_PLATFORM_LIVE_ALLOWED` | `false` hasta aprobar el lanzamiento real. |
| `PUBLIC_BASE_URL` | `https://www.datoya.cl`. |

**Seguridad:** credenciales `TEST-` son válidas únicamente con `MP_PLATFORM_MODE=test`; credenciales `APP_USR-` únicamente con `production`. El sistema necesita además coincidencia de ID del cobrador y autorización explícita mediante banderas. No habilitar solamente por existir una Public Key.

## Notificaciones y retorno
El backend genera notificaciones firmadas con referencia única a
`https://www.datoya.cl/api/platform-payments/webhook`.

Si la misma aplicación de Mercado Pago procesa ventas Split y servicios propios, configurar la firma para cada endpoint y confirmar en el panel de Mercado Pago la entrega correcta. DatoYa conserva el endpoint separado:
`https://www.datoya.cl/api/mp-split/webhook`
para cobros de comercios.

Los retornos del navegador vuelven a `/#/club` o `/#/mi-negocio-plan/{id}`. **Ningún retorno de navegador activa beneficios**. Solo las consultas desde el servidor a Mercado Pago, comprobadas contra referencia, monto exacto, moneda, cobrador, ambiente, preferencia y orden del proveedor, permiten la activación.

## Pruebas de salida obligatorias
1. Cuenta de Mercado Pago autorizada y, cuando corresponda, titular legal verificado.
2. Confirmar que el cargo de 30 días de Club se crea con el precio vigente y sin renovación automática.
3. Verificar Impulso / Impulso+ / Premium por 1, 7, 15 y 30 días.
4. Probar pago aprobado, pendiente, rechazado, devolución y webhook inválido. Comprobar que el beneficio se active **una sola vez**.
5. Verificar en el proveedor el dinero acreditado y las comisiones de procesamiento; el panel financiero de DatoYa no sustituye la conciliación bancaria.
6. Antes de operar con público general, revisar soporte, reembolsos, tratamiento tributario y documentación de cobros de servicios digitales.

## Riesgos que aún bloquean el lanzamiento público
- Habilitación contractual de Split 1:1 para compraventas de negocios y consentimiento de los titulares autorizados.
- Verificación humana de depósitos reales en las cuentas correctas y pruebas reales autorizadas.
- Flujo de reembolsos y cancelaciones de planes/Club a completar y comprobar, con conciliación.
- Publicidad semanal pagada todavía sin checkout productivo.
- Pruebas finales de Android, correo, notificaciones y QR con dispositivos reales.

La integración se publica con las banderas de checkout apagadas por defecto. **No cambiarlas hasta completar estas pruebas**.

Documentación oficial:
- https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post
- https://www.mercadopago.cl/developers/es/docs/checkout-pro-preferences/configure-back-urls
- https://www.mercadopago.cl/developers/es/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod
