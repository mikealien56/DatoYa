# DatoYa para Android (TWA)

DatoYa usa una Trusted Web Activity (TWA) sobre https://datoya.cl.

## Identidad Android

- Package ID: `cl.datoya.app`
- Dominio: `datoya.cl`
- Manifest web: `https://datoya.cl/manifest.webmanifest`
- Alias de firma: `datoya`
- SHA-256 del certificado: `96:22:E3:5B:2A:10:E3:4B:88:5B:2A:48:B1:21:3A:F1:C2:0D:C5:E8:02:C6:5C:61:DB:95:F6:FE:C7:AF:EB:E7`

La clave privada de firma **no debe subirse a GitHub**. El archivo esperado por Bubblewrap es:

`datoya-android-release.keystore`

## Compilar

Con Node.js, Java y Android SDK disponibles:

```bash
npm install -g @bubblewrap/cli
bubblewrap update --skipVersionUpgrade
bubblewrap build
```

Bubblewrap generará el APK firmado y el AAB usando la clave indicada en `twa-manifest.json`.
Las contraseñas pueden pasarse sin escribirlas en archivos mediante:

```bash
export BUBBLEWRAP_KEYSTORE_PASSWORD='...'
export BUBBLEWRAP_KEY_PASSWORD='...'
bubblewrap build
```

## Digital Asset Links

DatoYa publica `/.well-known/assetlinks.json` desde el arranque de producción.
La huella debe seguir coincidiendo con la clave con la que se firme cada APK/AAB.

Los cambios normales de la web no requieren recompilar la APK. Solo hace falta una nueva versión Android cuando cambien metadatos nativos, permisos, package ID, iconos nativos o configuración TWA.
