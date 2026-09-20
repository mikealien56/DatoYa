#!/bin/bash
set -euo pipefail

# DatoYa — verifica que un dump PostgreSQL pueda restaurarse en una base de PRUEBA vacía.
# Uso:
#   RESTORE_DATABASE_URL="postgresql://..." ./scripts/verify_postgres_restore.sh backups/datoya-....dump
#
# Seguridad:
# - nunca restaura sobre DATABASE_URL;
# - exige una base de destino vacía;
# - no usa --clean ni elimina objetos existentes.

DUMP_FILE="${1:-}"
TARGET_URL="${RESTORE_DATABASE_URL:-}"
SOURCE_URL="${DATABASE_URL:-}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: indica un archivo .dump válido"
  exit 1
fi
if [ -z "$TARGET_URL" ]; then
  echo "ERROR: falta RESTORE_DATABASE_URL"
  exit 1
fi
if [ -n "$SOURCE_URL" ] && [ "$TARGET_URL" = "$SOURCE_URL" ]; then
  echo "ERROR: RESTORE_DATABASE_URL no puede ser la base de producción"
  exit 1
fi
for cmd in pg_restore psql; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: falta $cmd"; exit 1; }
done

pg_restore --list "$DUMP_FILE" >/dev/null

USER_TABLES="$(psql "$TARGET_URL" -Atqc "SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');")"
if [ "${USER_TABLES:-0}" != "0" ]; then
  echo "ERROR: la base de restauración no está vacía ($USER_TABLES tablas de usuario)"
  exit 1
fi

echo "Restaurando backup en base de PRUEBA…"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$TARGET_URL" "$DUMP_FILE"

RESTORED_TABLES="$(psql "$TARGET_URL" -Atqc "SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');")"
if [ "${RESTORED_TABLES:-0}" = "0" ]; then
  echo "ERROR: la restauración terminó sin tablas de usuario"
  exit 1
fi

echo "Restauración OK: $RESTORED_TABLES tablas de usuario disponibles."
echo "La base de producción no fue modificada."
