# DatoYa — publicación en Galaxy Store y AppGallery

**Preparación en curso.** No está enviada ni aprobada en ninguna tienda. La descarga seguirá disponible por la web hasta la publicación oficial.

- **Aplicación:** DatoYa — Negocios cerca de ti.
- **Package ID previsto:** `cl.datoya.app` (ver `capacitor.config.json`).
- **País/idioma iniciales:** Chile / español (Chile).
- **Precio descarga:** gratuita, con transacciones y funciones de pago dentro de la plataforma.
- **APK histórico más reciente:** `DatoYa-Firebase-v2.3.5-PRUEBAS.apk`. **NO subir.**

### Requisitos bloqueantes

1. El titular adulto autorizado debe registrar/verificar cuentas en [Samsung Seller Portal](https://seller.samsungapps.com/) y [Huawei AppGallery Connect](https://developer.huawei.com/consumer/es/appgallery).
2. Recuperar/reconstruir Android Studio/Gradle (el repositorio no contiene `android/app/build.gradle` actualmente) desde el proyecto Capacitor existente y validar los complementos nativos Firebase.
3. Compilar APK de publicación, firmar con clave de distribución controlada por el titular y verificar firma/paquete. **Nunca subir APK debug ni publicar la clave.**
4. Confirmar políticas por tienda para compras de productos físicos y compras digitales (DatoYa Club, impulso, planes), enlaces legales, privacidad, datos del desarrollador y cuenta privada para revisores.
5. Realizar capturas reales de funciones terminadas, sin productos de prueba ni datos privados, y pruebas en equipos Samsung/Huawei.
6. Revisar términos legales (aún contienen el texto histórico «beta privada»), abrir y probar `https://www.datoya.cl/#/privacidad` y `https://www.datoya.cl/#/terminos`.
7. Enviar APK y ficha desde las cuentas aprobadas; esperar la decisión de revisión. No anunciar tiendas antes de aprobación.

Documentos: `listing-es-CL.md` y `quality-gates.md`. El ZIP de preparación generado en la conversación también incluye una herramienta para verificar el APK release.

Fuentes: [Samsung preparativos](https://developer.samsung.com/galaxy-store/prepare.html), [Samsung registro de app](https://developer.samsung.com/galaxy-store/launch.html), [AppGallery](https://developer.huawei.com/consumer/es/appgallery), [políticas Huawei](https://developer.huawei.com/consumer/en/doc/50104-overview).
