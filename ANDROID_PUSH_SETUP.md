# DatoYa — activación de notificaciones Android (Capacitor)

El APK de Capacitor usa un WebView: el envío mediante `PushManager` del navegador no funciona allí. El código actual separa dos canales: Web Push (Chrome/PWA/TWA) y Firebase Cloud Messaging (APK Capacitor).

## Pendientes externos para activar avisos nativos

1. En [Firebase Console](https://console.firebase.google.com/), crear/seleccionar proyecto y registrar una app **Android** con el paquete exacto `cl.datoya.app`.
2. Descargar **google-services.json** de la configuración de esa app. Codificar el archivo completo en Base64 **sin modificarlo** e introducirlo como secreto de GitHub Actions `DATOYA_FIREBASE_GOOGLE_SERVICES_B64`. Nunca subir el JSON a GitHub ni enviarlo por chat.
3. En Firebase/Google Cloud, habilitar la API **Firebase Cloud Messaging (HTTP v1)** y usar una **cuenta de servicio** con permiso de envío FCM al proyecto. Generar credenciales de servicio en un entorno seguro. Guardar el JSON de servicio codificado en Base64 en **Render**, como variable privada `DATOYA_FCM_SERVICE_ACCOUNT_JSON_B64` (o JSON sin codificar en `DATOYA_FCM_SERVICE_ACCOUNT_JSON`). Nunca colocar esa clave en archivos del frontend, el repositorio, el APK ni en la aplicación cliente.
4. Ejecutar el workflow GitHub «Build DatoYa Capacitor APK», verificando que el registro de Firebase se habilite. El workflow instala `@capacitor/push-notifications` únicamente si existe el secreto de configuración Android; si falta, sigue creando un APK **sin push** y lo advierte.
5. Firmar la nueva versión Android (`versionCode 8` o posterior) con la **misma clave de firma** que se usó para distribuir el APK actual, o distribuir por Google Play conforme al esquema de firma empleado. El artefacto de GitHub Actions se genera **sin firma**, no se instala directamente como actualización comercial.
6. Probar con dos cuentas en teléfonos distintos: activar permiso desde DatoYa → Avisos, verificar el registro de token en la API, enviar una prueba mientras la app está en segundo plano y abrir el aviso. Confirmar recepción de alertas, pedidos y respuestas «Lo Busco Ya».
7. Probar la opción de desactivar y el cierre de sesión (no deben llegar avisos a cuentas que ya no estén vinculadas a ese dispositivo).

## Diagnóstico

- Si el APK aún no trae el plugin, DatoYa muestra «Esta versión Android requiere actualizar la app» y explica cómo usar Chrome provisionalmente.
- Si el plugin está presente pero el servidor no tiene credenciales, muestra «Firebase pendiente de conectar» y no ofrece un botón engañoso.
- Si Firebase está configurado y la app trae el plugin, se permite solicitar permiso y registrar el token.
- El canal Web Push sigue usando `DATOYA_VAPID_PUBLIC_KEY` / `DATOYA_VAPID_PRIVATE_KEY`; no requiere Firebase ni cambia su funcionamiento.
- `GET /api/push/native/config` informa configuración y dispositivos registrados, sin revelar credenciales.
- `POST /api/push/native/test` envía una notificación real y reporta cuántos dispositivos se aceptaron en FCM. La recepción final se comprueba en el teléfono.

**No considerar los avisos nativos operativos solo porque hayan pasado los tests de CI**. Se requiere configurar las credenciales, generar una APK firmada y realizar una prueba de entrega real.
