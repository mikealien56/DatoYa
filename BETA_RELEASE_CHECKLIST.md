# DatoYa 2.0 — Puerta de beta controlada

DatoYa no debe ampliarse a público general hasta cumplir esta lista.

## Bloqueantes automáticos
- GitHub Actions principal en verde.
- PostgreSQL en verde.
- Modo beta real en verde y sin cuentas DEMO.
- Healthcheck responde correctamente.
- Rutas privadas rechazan acceso sin sesión.
- Flujo cliente → solicitud → cotización → selección → trabajo → finalización validado.
- Disputas, evidencias y chat protegidos.

## Bloqueantes externos
- Dominio definitivo configurado.
- Dominio/remitente verificado en Resend.
- Recuperación de contraseña y verificación de correo probadas con correo real.
- Copia de seguridad/restauración de PostgreSQL comprobada antes de ampliar la beta.

## Prueba humana móvil
Probar como cliente y como profesional, idealmente en dos cuentas reales distintas:
1. Registro e inicio/cierre de sesión.
2. Completar perfil profesional y especialidades.
3. Publicar solicitud con y sin fotos.
4. Encontrar solicitud y enviar cotización.
5. Seleccionar profesional; comprobar que las otras conversaciones queden cerradas.
6. Chat del profesional seleccionado.
7. Confirmación de encuentro e inicio del trabajo.
8. Evidencias del trabajo.
9. Confirmación mutua de finalización.
10. Reseña y apertura/resolución de disputa en una prueba separada.
11. Revisar notificaciones, estados vacíos, errores y navegación atrás en móvil.

## Alcance inicial recomendado
- Beta cerrada por invitación.
- Pocos clientes y profesionales al comienzo.
- Pagos reales desactivados mientras Mercado Pago siga en modo TEST.
- Revisar errores y casos de soporte antes de aumentar usuarios.

## Criterio de salida
La beta puede ampliarse solo cuando no haya bloqueantes críticos abiertos y los flujos principales hayan sido comprobados tanto automáticamente como por una prueba humana en móvil.
