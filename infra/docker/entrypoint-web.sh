#!/bin/sh
set -eu
CERT_DIR="${CERT_DIR:-/certs}"
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/captura7.crt" ] || [ ! -f "$CERT_DIR/captura7.key" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/captura7.key" \
    -out "$CERT_DIR/captura7.crt" \
    -subj "/CN=captura7"
fi
exec nginx -g 'daemon off;'
