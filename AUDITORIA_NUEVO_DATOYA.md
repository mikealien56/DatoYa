# Auditoría inicial — Nuevo DatoYa

Rama de trabajo: `feature/new-datoya-phase-a`. La versión activa de `main` y Render no se modifican.

## Se conserva

- Node/Express, autenticación, sesiones y controles de acceso.
- SQLite para desarrollo y adaptador PostgreSQL para producción.
- Regiones, comunas, GPS, cálculo de distancia y ubicación manual.
- Notificaciones, favoritos, opiniones, reportes y seguridad de cuentas.
- Base de Mercado Pago en modo protegido/TEST, sin activar dinero real.
- Infraestructura de pruebas y despliegue existente.

## Se transforma gradualmente

- `worker_profiles` pasa a una futura entidad de negocios/emprendimientos.
- Categorías de oficios pasan a categorías comerciales administrables.
- Portafolio pasa a catálogo, productos, promociones y fotografías.
- DatoYa PRO pasa a **DatoYa Impulso**.
- Solicitudes/cotizaciones pasan a búsqueda, pedidos y “Lo Busco Ya”.
- Trabajos y ganancias pasan a pedidos, ventas, comisión y neto del comercio.
- Home, registro, panel profesional y administración requieren nuevas experiencias comerciales.

## Se retira de la experiencia visible

- Lenguaje de maestros, técnicos, trabajadores y oficios.
- DatoYa PRO como nombre del plan.
- Flujo de contratación de trabajos como corazón del producto.
- Menús duplicados y paneles heredados visualmente antiguos.

## Riesgos y estrategia

- No renombrar tablas destructivamente al inicio: crear el nuevo dominio comercial en paralelo y migrar con compatibilidad temporal.
- No eliminar datos legacy hasta disponer de respaldo y migración verificada.
- Mantener pagos reales desactivados hasta completar pedidos, webhooks, conciliación e idempotencia.
- Implementar y validar por fases; cada fase debe conservar navegación, permisos y privacidad.

## Fase A aplicada en esta rama

- Activos originales del logo horizontal e icono cuadrado conservados.
- Variantes PWA 192×192, 512×512, maskable y favicon.
- Manifest instalable y service worker básico con actualización por red y respaldo de shell.
- Nueva paleta oficial, tipografía Poppins con fallbacks y cabecera de marca.
- Nombre, descripción y slogan actualizados sin reemplazar aún el dominio funcional legacy.
