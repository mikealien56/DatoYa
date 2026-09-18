# DatoYa — Puerta de beta comercial controlada

## Estado verificado · 18 septiembre 2026
- ✅ Render LIVE y autoDeploy activo.
- ✅ Seis suites GitHub Actions en verde.
- ✅ PostgreSQL marketplace operativo.
- ✅ Resend configurado en Render; falta confirmar entrega real con el botón Admin → Integraciones.
- ✅ Mercado Pago OAuth y webhook configurados; falta conectar un vendedor TEST y completar el pago sandbox punta a punta.
- ✅ Despacho avanzado probado automáticamente: costo, mínimo, gratis desde monto y radio.
- ✅ Métricas reales de ⚡ Impulso Ahora y ⭐ Impulso de la semana probadas con pedidos TEST atribuidos.
- ⚠️ Web Service Render sigue en plan Free.
- ⚠️ PostgreSQL sigue en plan Free y Render informa expiración el 13 de octubre de 2026.
- ⚠️ Backup lógico preparado en `scripts/backup_postgres.sh`, pero aún falta ejecutar y comprobar una restauración en una base NO productiva.

DatoYa puede mostrarse a comercios reales durante una beta cerrada, pero no debe ampliarse a público general hasta cumplir esta lista.

## Bloqueantes automáticos
- GitHub Actions principal en verde.
- PostgreSQL en verde.
- Healthcheck responde correctamente.
- Rutas privadas rechazan acceso sin sesión.
- Negocio real: registro → revisión Admin → aprobación → publicación.
- Producto real: creación → edición → stock → visibilidad pública.
- Carrito de un solo negocio y pedido comercial validados.
- Stock baja una sola vez y se restituye correctamente al cancelar cuando corresponde.
- Emprendimientos desde casa no exponen dirección residencial exacta.
- GPS/comuna y búsqueda por cercanía funcionan con fallback territorial.
- ⚡ Impulso Ahora valida horario, stock y estados.
- ⭐ Impulso de la semana solo publica ofertas aprobadas.
- Mercado Pago TEST no permite checkout sin conexión válida del comercio.
- Sello Negocio Fundador solo puede asignarlo Admin.
- Estadísticas privadas solo son visibles por el dueño del negocio.

## Bloqueantes externos
- Dominio definitivo configurado antes del lanzamiento público.
- Remitente/dominio de correo verificado.
- Recuperación de contraseña y verificación de correo probadas con correo real.
- Copia de seguridad y restauración de PostgreSQL comprobadas en una base NO productiva. El script de backup ya está preparado.
- Mercado Pago probado de punta a punta con usuarios/credenciales TEST.
- Revisión legal/tributaria final antes de escalar cobros y comisiones.

## Prueba humana móvil
Probar idealmente con dos cuentas distintas: comerciante y comprador.

1. Registro, login, logout y persistencia de sesión.
2. Registrar negocio físico.
3. Registrar emprendimiento desde casa y comprobar privacidad.
4. Pedir corrección desde Admin, corregir y reenviar.
5. Aprobar negocio y comprobar ficha pública por slug.
6. Cargar productos con precio, oferta, foto y stock.
7. Probar búsqueda, categoría, GPS/comuna y ficha del negocio.
8. Probar WhatsApp, compartir enlace y QR.
9. Probar sello Negocio Fundador.
10. Crear ⚡ Impulso Ahora y comprobar stock/horario.
11. Crear y aprobar ⭐ Impulso de la semana.
12. Agregar al carrito, crear pedido y cambiar estados.
13. Cancelar un pedido permitido y verificar restitución de stock.
14. Revisar estadísticas reales: vistas, productos, WhatsApp, compartidos, pedidos y ventas completadas.
15. Revisar despacho: costo, mínimo, radio y despacho gratis.
16. Revisar métricas de ⚡ Impulso Ahora y ⭐ Impulso de la semana.
17. Revisar estados vacíos, errores, navegación atrás y experiencia PWA.

## Contenido DEMO
- Los negocios DEMO pueden mantenerse para explicar la propuesta mientras haya pocos comercios reales.
- Deben estar claramente marcados DEMO / Ejemplo ilustrativo.
- No generan pedidos, pagos, stock ni estadísticas reales.
- No aparecen como verificados ni como Negocio Fundador real.

## Alcance inicial recomendado
- Beta cerrada por invitación.
- Pocos comercios reales al comienzo.
- Usar Mercado Pago TEST hasta validar OAuth, checkout, webhook, estados e idempotencia.
- Revisar errores y soporte antes de aumentar usuarios.

## Criterio de salida
La beta puede ampliarse cuando no existan bloqueantes críticos abiertos y el recorrido cuenta → negocio → aprobación → catálogo → descubrimiento → pedido → stock → pago TEST haya sido comprobado automáticamente y por una prueba humana móvil.
