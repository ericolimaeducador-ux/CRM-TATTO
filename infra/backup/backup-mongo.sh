#!/bin/sh
# Cópia lógica do Mongo do captura7. Não substitui o ensaio 3-2-1 cifrado.
# Uso: MONGO_URI=mongodb://127.0.0.1:27017/captura7 sh infra/backup/backup-mongo.sh [pasta]
set -eu
DESTINO="${1:-./backup-captura7}"
mkdir -p "$DESTINO"
NOME="captura7-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
if [ -z "${MONGO_URI:-}" ]; then
  echo "Defina MONGO_URI. No Docker, use os comandos do README, sem este script." >&2
  exit 1
fi
mongodump --uri="$MONGO_URI" --archive="$DESTINO/$NOME" --gzip
echo "Arquivo: $DESTINO/$NOME"
echo "Copie esse arquivo para um pen drive ou outro computador. O disco desta máquina não conta como cópia externa."
