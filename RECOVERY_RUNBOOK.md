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

Se creó una copia aislada desde `main` y, a partir de esa copia, una segunda rama de verificación para simular una recuperación sin tocar producción.

Resultado:

- 77 tablas públicas presentes en origen y restauración.
- 713 columnas con la misma firma.
- 149 índices con la misma firma.
- 748 restricciones con la misma firma.
- Sin diferencias de conteos en ninguna de las 77 tablas.
- Sin diferencias de contenido en 17 tablas críticas verificadas mediante hashes internos, entre ellas `users`, `market_account_types`, `businesses`, `products`, `commerce_orders`, `commerce_order_items`, `notifications`, `support_cases`, `market_categories`, `settings`, `mercadopago_connections`, `market_alerts`, `wanted_requests` y `push_subscriptions`.
- Conteos críticos del punto de recuperación: 15 usuarios, 15 tipos de cuenta, 1 negocio, 1 producto, 5 pedidos, 5 ítems de pedido, 20 categorías, 19 notificaciones y 1 caso de soporte.

La verificación confirma que una copia de rama actual de Neon conserva estructura y datos de DatoYa y puede usarse como punto de recuperación aislado.

La validación con `pg_dump` / `pg_restore` sigue pendiente porque el entorno utilizado para esta revisión no dispone del cliente PostgreSQL. Además, el proyecto alcanzó su límite actual de snapshots manuales: existe `datoya-beta-backup-20260921`, con vencimiento 28-09-2026. No se eliminó ni reemplazó ningún snapshot durante esta comprobación.
