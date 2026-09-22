# Recuperación segura de PostgreSQL / Neon

Este procedimiento protege producción: nunca restaura sobre `DATABASE_URL` ni elimina datos reales.

## 1. Generar y validar un respaldo lógico

Con las herramientas cliente de PostgreSQL instaladas y `DATABASE_URL` apuntando a Neon producción:

```bash
BACKUP_DIR="$PWD/backups" DATABASE_URL='postgresql://…' bash scripts/backup_postgres.sh
```

El script genera un dump en formato custom, comprueba su catálogo con `pg_restore --list` y crea un archivo SHA-256. Los respaldos contienen datos sensibles: deben guardarse cifrados, con acceso restringido y fuera del repositorio.

## 2. Restaurar sin tocar producción

Crear una base temporal vacía o una rama Neon temporal. Para validar un dump lógico, usar una base vacía y una URL distinta:

```bash
SOURCE_DATABASE_URL='postgresql://produccion/…' \
RESTORE_DATABASE_URL='postgresql://temporal-vacia/…' \
BACKUP_FILE="$PWD/backups/datoya-AAAAmmddTHHMMSSZ.dump" \
bash scripts/verify_postgres_restore.sh
```

El verificador rechaza una URL de destino igual al origen, exige que el destino esté vacío, restaura con `pg_restore --exit-on-error` y confirma que existan tablas públicas.

Después comparar al menos `users`, `businesses`, `products`, `commerce_orders`, `market_account_types` y `support_cases`. Ejecutar pruebas funcionales usando exclusivamente la URL temporal. Eliminar solo el recurso temporal creado para la prueba cuando ya no sea necesario.

## 3. Recuperación de emergencia

1. Detener escrituras o poner la aplicación en mantenimiento.
2. Identificar el punto de recuperación y conservar el estado afectado para análisis.
3. Crear una rama/base nueva; no sobrescribir producción durante la validación.
4. Restaurar el dump y verificar esquema, conteos críticos, autenticación, pedidos y paneles.
5. Cambiar la conexión de Render únicamente tras aprobación y una ventana controlada.
6. Confirmar healthcheck, logs y flujos Cliente/Negocio/Admin antes de reabrir escrituras.

## Verificación realizada el 22-09-2026

Se creó una rama Neon aislada desde producción y se comparó con `main`. Coincidieron 75 tablas públicas y los conteos críticos: 15 usuarios, 1 negocio, 1 producto, 5 pedidos, 15 tipos de cuenta y 1 caso de soporte. Esta comprobación valida la restauración instantánea por rama de Neon; no sustituye la restauración periódica de un dump lógico en una base vacía.
