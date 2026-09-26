#!/bin/sh
set -eu
CERT_DIR="${CERT_DIR:-/certs}"
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/captura7.crt" ] || [ ! -f "$CERT_DIR/captura7.key" ]; then
  CERT_DIR="$CERT_DIR" /gerar-ca-local.sh
fi
exec nginx -g 'daemon off;'
