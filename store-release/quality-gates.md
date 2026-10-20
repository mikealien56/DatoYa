# Control de calidad antes de subir DatoYa

- [ ] Samsung Commercial Seller y Huawei Developer verificados por titular elegible.
- [ ] Android Studio/Gradle y complementos Capacitor restaurados; configuración de push en Huawei sin GMS revisada.
- [ ] APK release firmado con certificado definitivo, revisado con apksigner y package `cl.datoya.app`.
- [ ] Si se usa Android App Links/TWA, actualizar la huella de `.well-known/assetlinks.json` solo con la firma de publicación confirmada.
- [ ] Inicio, login, alta de usuario/negocio, catálogo real, stock, carrito, checkout y retorno desde Mercado Pago probados en ambos fabricantes.
- [ ] Mercado Pago Split verificado con cuenta vendedora auténtica; refunds, correo y permisos probados con adultos autorizados.
- [ ] Club, planes y destacados evaluados conforme a políticas de compras digitales de cada tienda.
- [ ] Política de privacidad, condiciones, eliminación de cuenta, permisos Android y soporte validados legal y técnicamente.
- [ ] Capturas de app real; sin datos falsos, marcas de beta, pantallas de prueba ni información privada.
- [ ] Cuenta de revisión creada y compartida solo mediante portal privado de la tienda.
- [ ] Validación final en dispositivos Samsung y Huawei y aprobación de revisores.

**No usar `DatoYa-Firebase-v2.3.5-PRUEBAS.apk` para un lanzamiento.** El paquete de preparación en ZIP incluye un inventario de APK previos y un script `validar_apk_release.sh`.
