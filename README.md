# DatoYa — Primera versión funcional

Plataforma que conecta personas que necesitan un servicio con trabajadores independientes en Chile.

## Cómo ejecutar

```bash
cd datoya
npm install
npm start          # o: node server.js
```

Abre **http://localhost:3000**

## Cuentas DEMO (contraseña: demo1234)

| Rol | Correo |
|---|---|
| 👤 Cliente | cliente@demo.cl |
| 🔧 Trabajador | trabajador@demo.cl |
| 🛡️ Administrador | admin@demo.cl |

## Estructura

```
datoya/
├── server.js      # API REST (Express): auth, búsqueda, solicitudes, cotizaciones, trabajos, chat, reseñas, admin
├── db.js          # Esquema SQLite + datos DEMO (20 trabajadores, 10 categorías, 34 comunas, 16 regiones)
├── public/
│   ├── index.html # Shell de la SPA
│   ├── app.js     # Frontend completo (router, vistas, formularios, chat, admin)
│   └── styles.css # Identidad visual mobile-first
├── test_e2e.sh    # 34 pruebas automatizadas de la API
└── datoya.db      # Base de datos SQLite (se crea sola al iniciar)
```

## Flujo de prueba sugerido (5 minutos)

1. **Cliente** (cliente@demo.cl): Inicio → Buscar → ver perfil → "Solicitar" → publicar solicitud (wizard de 7 pasos).
2. **Trabajador** (trabajador@demo.cl): Solicitudes → ver solicitudes de tu zona → enviar cotización.
3. **Cliente**: Mis solicitudes → comparar cotizaciones → "Elegir".
4. **Trabajador**: Trabajos → Confirmar → Iniciar trabajo.
5. **Cliente**: Trabajos → "Marcar como terminado" (registra pago DEMO + comisión 10%) → Calificar con estrellas.
6. **Admin** (admin@demo.cl): Panel → dashboard, usuarios, verificaciones, denuncias, comisión configurable.

## Pruebas automatizadas

```bash
bash test_e2e.sh   # 34 verificaciones: auth, RBAC, flujo completo, chat anti-estafas, admin
```

## Modo DEMO (sin integraciones reales aún)

- Pagos y retiros: registrados en BD, marcados como `DEMO`, sin dinero real.
- Verificación de teléfono: acepta cualquier código de 4 dígitos (en producción: SMS).
- Fotos de solicitud: referencia local (en producción: storage tipo S3).
- Distancias: calculadas con coordenadas de comunas (Haversine). En producción: mapa real.

## Preparado para producción

- Cambiar SQLite → PostgreSQL (migración directa del esquema).
- Integrar Webpay Plus / Flow / Mercado Pago en `/api/payments`.
- Integrar SMS (ej. Twilio) en `/api/auth/verify-phone`.
- Integrar mapas (Google Maps / Mapbox) — las comunas ya tienen lat/lng.
- Variables de entorno: `PORT`, agregar `SESSION_SECRET` y HTTPS.
