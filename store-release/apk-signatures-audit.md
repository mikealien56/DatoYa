# Auditoría de firma Android — 20-10-2026

Se inspeccionaron los bloques de firma de los APK de la biblioteca DatoYa; los APK no se vuelven a distribuir.

| APK | CN certificado | SHA-256 | Estado |
|---|---|---|---|
| DatoYa-2.3.3.apk | DatoYa Android Beta | 28:FE:79:99:1E:36:7E:6A:E2:3F:B3:EB:C2:F7:AA:36:4C:DA:BD:39:45:22:0C:F7:BC:C0:FB:3B:24:79:8F:3D | Beta histórica |
| DatoYa-Firebase-v2.3.4-PRUEBAS.apk | Android Debug | A2:7B:5C:2A:D3:26:83:9A:84:49:09:8F:0E:04:DA:1B:10:0A:2C:EA:97:17:4A:3D:DB:11:69:8E:9C:67:F1:72 | NO publicar |
| DatoYa-Firebase-v2.3.5-PRUEBAS.apk | Android Debug | B2:B3:67:95:A1:FC:48:3F:4C:52:33:67:93:6D:3D:5E:BB:26:95:FB:74:1E:8F:A4:69:01:65:94:BD:04:15:EF | NO publicar |

La huella de `.well-known/assetlinks.json` es `96:22:E3:5B:2A:10:E3:4B:88:5B:2A:48:B1:21:3A:F1:C2:0D:C5:E8:02:C6:5C:61:DB:95:F6:FE:C7:AF:EB:E7`, que **no coincide con ningún APK inspeccionado**.

Requisito: recuperar/regenerar proyecto Android Studio/Gradle, compilar APK release con firma controlada por editor adulto autorizado, verificar certificado y actualizar huella de App Links/TWA si se usa. No publicar APK de pruebas ni claves privadas en GitHub. Hasta ahora **no hay APK release verificado** y no se ha enviado nada a tiendas.
