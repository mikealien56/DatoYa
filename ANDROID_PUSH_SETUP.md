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

## APK instalable para pruebas (antes de Google Play)

La compilación GitHub Actions **Build DatoYa Capacitor APK** genera dos artefactos distintos:

- `datoya-android-pruebas-debug`: contiene `DatoYa-Android-PRUEBAS-debug.apk`, firmada automáticamente con la clave **de depuración** por Android. Solo sirve para probar registro Firebase y recepción en teléfonos de ensayo. La advertencia por descarga fuera de Google Play puede seguir apareciendo.
- `datoya-capacitor-apk-unsigned`: contiene `DatoYa-Capacitor-unsigned.apk`, **sin firma**, no apta para instalar o distribuir directamente. Debe firmarse con la clave comercial antes de publicarla.

El workflow verifica `cl.datoya.app` y el proyecto Firebase `datoya-d9669`. En compilaciones de la rama principal falla si no está `DATOYA_FIREBASE_GOOGLE_SERVICES_B64`, para evitar repartir un APK sin notificaciones reales.

**No intentes actualizar una instalación ya firmada con otra clave utilizando la APK debug**: Android rechazará la actualización. Para una prueba separada, utiliza un dispositivo de ensayo o, después de respaldar datos necesarios, desinstala la versión anterior de la aplicación y prueba la de depuración. La cuenta y datos conservados en el servidor no dependen de la instalación local, pero las preferencias/archivos locales pueden perderse.

## Cómo verificar la recepción en un teléfono

1. Confirma que GitHub Actions terminó exitosamente y que el log de instalación mostró "Firebase Android configurado".
2. En un dispositivo de ensayo instala `DatoYa-Android-PRUEBAS-debug.apk`; entra con una cuenta de prueba.
3. Ve a **Notificaciones → Activar avisos**, acepta el permiso Android y comprueba que cambie a **Activadas en este dispositivo**.
4. Comprueba que `native_push_tokens` aumente y luego pulsa **Probar aviso**. Debe confirmar al menos un envío aceptado.
5. Deja DatoYa en segundo plano y comprueba físicamente recepción, sonido/vibración según ajustes y apertura del destino al tocar el aviso.
6. Prueba con segunda cuenta y los eventos reales: pedido, mensaje/soporte y respuesta a **Lo Busco Ya**.
7. Desactiva avisos y cierra sesión; verifica que la cuenta anterior ya no reciba avisos en ese teléfono.

El servidor ya puede **validar** la cuenta de servicio, pero esto **no prueba la entrega** por sí solo. Una prueba en el dispositivo es indispensable.

## Diagnóstico

- Si el APK aún no trae el plugin, DatoYa muestra «Esta versión Android requiere actualizar la app» y explica cómo usar Chrome provisionalmente.
- Si el plugin está presente pero el servidor no tiene credenciales, muestra «Firebase pendiente de conectar» y no ofrece un botón engañoso.
- Si Firebase está configurado y la app trae el plugin, se permite solicitar permiso y registrar el token.
- El canal Web Push sigue usando `DATOYA_VAPID_PUBLIC_KEY` / `DATOYA_VAPID_PRIVATE_KEY`; no requiere Firebase ni cambia su funcionamiento.
- `GET /api/push/native/config` informa configuración y dispositivos registrados, sin revelar credenciales.
- `POST /api/push/native/test` envía una notificación real y reporta cuántos dispositivos se aceptaron en FCM. La recepción final se comprueba en el teléfono.

**No considerar los avisos nativos operativos solo porque hayan pasado los tests de CI**. Se requiere configurar las credenciales, generar una APK firmada y realizar una prueba de entrega real.
