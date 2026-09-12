# DatoYa 2.0

Marketplace de servicios locales en Chile que conecta clientes con trabajadores independientes.

## Estado actual

La aplicación ya cuenta con el flujo principal funcional: autenticación, roles, búsqueda de profesionales, solicitudes, cotizaciones, trabajos, chat, reseñas, favoritos, notificaciones, fotos de solicitudes, verificaciones, denuncias, evidencias, panel administrativo y comisión configurable.

## Flujo principal

1. Cliente crea una solicitud de servicio.
2. DatoYa identifica profesionales compatibles por categoría y territorio.
3. Profesionales pueden revisar la solicitud y enviar cotizaciones.
4. El cliente compara y elige una cotización.
5. Se crea el trabajo y se controla su estado hasta finalizarlo.
6. Al finalizar se registra el pago y la comisión de DatoYa (10% por defecto).
7. Cliente y profesional pueden calificar la experiencia.
8. El chat protege los datos de contacto antes de aceptar un trabajo.
9. Las denuncias y disputas pueden ser revisadas desde administración.

## Seguridad y privacidad

- Autenticación mediante sesión HTTP-only.
- Control de acceso por rol.
- Protección de conversaciones privadas.
- Los profesionales incompatibles no pueden acceder a solicitudes restringidas.
- Un profesional solo puede consultar sus propias cotizaciones.
- El intercambio de teléfono, correo y otros datos de contacto queda protegido en el chat antes de aceptar un trabajo.
- Las fotos de solicitudes tienen control de acceso.

## Comisión

La comisión de DatoYa está configurada en **10% por defecto** sobre el valor del trabajo. El porcentaje puede administrarse mediante la configuración de la plataforma.

## Modo DEMO

Actualmente algunas integraciones externas todavía funcionan en modo DEMO:

- Pagos: registrados en la base de datos, sin cobro de dinero real.
- Retiros: registrados como solicitudes, sin transferencia bancaria real.
- Verificación telefónica: simulada.
- Almacenamiento de fotos: preparado para migrar a almacenamiento externo.
- Mapas/GPS: existe la base territorial y cálculo de distancias; falta integración completa con proveedor de mapas.

## Pendientes para producción

### Prioridad alta

- Validar despliegue definitivo en Render y revisar errores específicos del entorno de producción.
- Integrar proveedor de pagos real (Webpay Plus, Flow u otro compatible con Chile).
- Implementar retiros reales para profesionales.
- Integrar verificación telefónica mediante SMS.
- Migrar almacenamiento de fotos a un servicio persistente.

### Prioridad media

- Integrar mapas y ubicación GPS real.
- Push notifications.
- Completar flujo de disputas, reembolsos y resolución administrativa.
- Mejorar portafolio profesional con imágenes reales.
- Endurecer controles anti-spam y rate limiting.

### Infraestructura

- Evaluar migración de SQLite a PostgreSQL para producción/escala.
- Configurar variables de entorno y secretos fuera del código.
- HTTPS y configuración segura de cookies/sesiones.
- Monitoreo y logs de producción.

## Desarrollo local

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`.

## Pruebas

```bash
bash test_ci.sh
```

El flujo E2E cubre autenticación, permisos, solicitudes, cotizaciones, trabajos, chat anti-estafas, fotos, compatibilidad, privacidad de cotizaciones y administración.

## Arquitectura de arranque

`territory_start.js` es el punto de entrada recomendado. Prepara los archivos públicos y aplica los parches de funcionalidad antes de iniciar el servidor.

El endpoint `/health` permite comprobar que la aplicación y la base de datos están operativas:

```text
GET /health
```

Respuesta saludable:

```json
{"ok":true,"service":"datoya","status":"healthy"}
```
