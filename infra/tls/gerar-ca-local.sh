#!/bin/sh
set -eu
CERT_DIR="${CERT_DIR:-./certs-local}"
DIAS="${CERT_DIAS:-825}"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/ca.key" ] || [ ! -f "$CERT_DIR/ca.crt" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days "$DIAS" \
    -keyout "$CERT_DIR/ca.key" \
    -out "$CERT_DIR/ca.crt" \
    -subj "/CN=captura7-ca-local"
fi

SAN="DNS:localhost,IP:127.0.0.1"
if [ -n "${CERT_IPS:-}" ]; then
  antigo="$IFS"
  IFS=','
  for ip in $CERT_IPS; do
    limpo=$(printf '%s' "$ip" | tr -d '[:space:]')
    if [ -n "$limpo" ]; then
      SAN="$SAN,IP:$limpo"
    fi
  done
  IFS="$antigo"
fi

openssl req -new -nodes -newkey rsa:2048 \
  -keyout "$CERT_DIR/captura7.key" \
  -out "$CERT_DIR/captura7.csr" \
  -subj "/CN=captura7"

printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' "$SAN" \
  > "$CERT_DIR/captura7.ext"

openssl x509 -req -in "$CERT_DIR/captura7.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/captura7.crt" -days "$DIAS" \
  -extfile "$CERT_DIR/captura7.ext"

rm -f "$CERT_DIR/captura7.csr" "$CERT_DIR/captura7.ext"
chmod 600 "$CERT_DIR/ca.key" "$CERT_DIR/captura7.key" 2>/dev/null || true
printf '%s\n' "CA e certificado gravados em $CERT_DIR. Instale ca.crt no computador e no celular."
