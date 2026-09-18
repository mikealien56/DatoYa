#!/bin/bash
set -euo pipefail

# DatoYa — backup lógico PostgreSQL. Solo lectura.
# Requiere: pg_dump, pg_restore y DATABASE_URL.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL"
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump no está instalado"
  exit 1
fi
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore no está instalado"
  exit 1
fi

umask 077
OUT_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/datoya-${STAMP}.dump"
CHECKSUM="$FILE.sha256"

echo "Creando backup lógico DatoYa…"
pg_dump --format=custom --no-owner --no-acl --file="$FILE" "$DATABASE_URL"

# Valida que el dump sea legible sin restaurar nada.
pg_restore --list "$FILE" >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$FILE" > "$CHECKSUM"
else
  shasum -a 256 "$FILE" > "$CHECKSUM"
fi

echo "Backup OK: $FILE"
echo "Checksum: $CHECKSUM"
echo "No se modificó la base de datos."
