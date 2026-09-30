# DatoYa — preparación de Comercio Integrador Khipu V3

Estado: dinero real bloqueado. No se han creado cuentas hijas ni enviado datos a Khipu.

## Contrato oficial revisado el 30-09-2026

- POST https://payment-api.khipu.com/v3/receivers, x-api-key de cuenta padre.
- GET /v3/receivers/children: id, can_collect, disabled; paginar antes de concluir que una cuenta no existe.
- POST /v3/payments, x-api-key de cuenta hija, integrator_fee desde la comisión persistida del pedido.
- https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postreceiver
- https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getreceivers
- https://docs.khipu.com/payment-solutions/instant-payments/payment-advanced

POST receivers requiere contratación independiente y habilitación de Khipu. La creación no equivale a activación. El negocio completa personalmente la validación en Khipu. No se recopilan datos bancarios ni se usa V2.

## Existente

Checkout y consulta de pagos V3 mediante x-api-key. Cuenta padre de desarrollo; integrator_fee aplicado=false. Onboarding por negocio con autorización de propietario. Cálculo de comisión guardado en commerce_orders.datoya_commission_estimate, con reglas de lanzamiento/plan/cupones. Webhook y seguimiento actuales limitados a desarrollo.

## Preparado en esta versión

khipu_integrator.js contiene descriptores de solicitudes V3, mapeo explícito de campos, almacenamiento/lectura cifrados y validación de respuesta de activación. business_khipu_credentials guarda un sobre AES-256-GCM, con AAD vinculada al negocio y nonce aleatorio; la clave permanece fuera de la base y del código. El módulo es server-only y no se copia a public. saveReceiver y recordActivation son operaciones transaccionales internas sin rutas públicas.

No se genera, cambia ni configura ningún secreto. DATOYA_KHIPU_CREDENTIAL_KEY es el nombre reservado para una futura clave de 32 bytes en Base64; sin ella el almacenamiento falla antes de escribir. Su custodia y rotación deben acordarse antes de usar credenciales reales. Un api_key ausente se rechaza: no se retrocede a autenticación V2.

Estados públicos: not_started, pending_integrator, receiver_created, pending_khipu_activation, active, error. Se reconocen los estados anteriores sin migrar registros existentes. El botón de preparación sólo guarda datos y deja pending_integrator; no ejecuta POST receivers. No se devuelve ninguna credencial ni respuesta cruda del proveedor al cliente.

paymentRequest exige negocio coincidente, receiver coincidente, estado active y evidencia server-side de activación; usa la API key hija, la comisión persistida del pedido y un coste Khipu explícito para respetar el límite de integrator_fee. No inventa el coste del proveedor ni calcula el neto final como total menos sólo la comisión DatoYa.

createReceiver y createChildPayment fallan cerrados. RELEASE_NETWORK_ENABLED=false es un bloqueo de código independiente de variables de entorno. Los pagos de desarrollo existentes siguen su recorrido anterior.

## Pendiente comercial exclusivamente

Contrato/habilitación del servicio de integrador; confirmación del entorno de pruebas de cuentas hijas; condiciones/tarifas y proceso de validación de negocios por Khipu. Ninguna variable local acredita esta contratación.

## Pendiente técnico para una futura activación

Tras la habilitación: configurar la clave de cifrado con autorización; conectar transporte V3 a estos descriptores con control de concurrencia y reconciliación ante timeout (no reintentar POST receivers ciegamente); persistir inmediatamente las credenciales devueltas; consultar hijos con paginación y verificar can_collect=true/disabled=false; integrar la selección de cuenta hija también en consultas, firma de webhook y conciliación, no sólo al crear el pago. Validar URLs, identidad, moneda, monto, transaction_id y comisión de la respuesta. Confirmar rendición y coste Khipu. No existe todavía un recorrido de dinero real habilitado; esta preparación no afirma que sólo cambiar una variable permita cobrar.

## Verificación

test_khipu_integrator.js usa SQLite en memoria y credenciales inventadas exclusivamente locales. Cubre cifrado, alteración de sobre, aislamiento entre negocios, duplicados, activación/revocación, campos V3, comisión cero/límite y bloqueo aun con flags activados. npm test corre en una copia aislada sin base ni credenciales de producción.
