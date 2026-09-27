#!/bin/sh
set -eu
ARQUIVO="${SEGREDOS_ARQUIVO:-/segredos/captura7.env}"
DIR=$(dirname "$ARQUIVO")

if [ -f "$ARQUIVO" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ARQUIVO"
  set +a
fi

if [ -z "${CIFRA_CHAVE_BASE64:-}" ] || [ -z "${CIFRA_PEPPER:-}" ]; then
  if [ "${NODE_ENV:-development}" = "production" ]; then
    if [ ! -d "$DIR" ]; then
      echo '{"nivel":"ERROR","evento":"volume_ausente","mensagem":"Em produção a API não gera chave nova a cada reinício. No Render, defina CIFRA_CHAVE_BASE64 e CIFRA_PEPPER nas variáveis e suba com node dist/main.js, sem SEGREDOS_ARQUIVO. No computador, monte o volume de segredos. Nada foi gerado."}' >&2
      exit 1
    fi
    CIFRA_CHAVE_BASE64="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
    CIFRA_PEPPER="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
    umask 077
    printf 'CIFRA_CHAVE_BASE64=%s\nCIFRA_PEPPER=%s\n' "$CIFRA_CHAVE_BASE64" "$CIFRA_PEPPER" >"$ARQUIVO"
    chmod 600 "$ARQUIVO"
    export CIFRA_CHAVE_BASE64 CIFRA_PEPPER
    echo '{"nivel":"INFO","evento":"segredo_gerado","mensagem":"Chave e pepper gravados no volume. Os valores não foram impressos."}'
  else
    CIFRA_CHAVE_BASE64="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
    CIFRA_PEPPER="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
    export CIFRA_CHAVE_BASE64 CIFRA_PEPPER
    echo '{"nivel":"WARN","evento":"segredo_efemero_dev","mensagem":"Chave e pepper gerados só nesta execução de development. Não servem para produção nem sobrevivem a um container novo."}'
  fi
fi

node <<'NODE'
const chave = Buffer.from(process.env.CIFRA_CHAVE_BASE64 || '', 'base64');
const pepper = (process.env.CIFRA_PEPPER || '').trim();
if (!pepper || /preencha/i.test(pepper) || pepper.length < 32) {
  console.error(JSON.stringify({
    nivel: 'ERROR',
    evento: 'pepper_invalido',
    mensagem: 'CIFRA_PEPPER vazio, placeholder ou com menos de 32 caracteres.',
  }));
  process.exit(1);
}
if (chave.length !== 32) {
  console.error(JSON.stringify({
    nivel: 'ERROR',
    evento: 'chave_invalida',
    mensagem: 'CIFRA_CHAVE_BASE64 precisa decodificar 32 bytes.',
  }));
  process.exit(1);
}
NODE

if [ "$(id -u)" = "0" ]; then
  chown node:node "$ARQUIVO" 2>/dev/null || true
  exec su-exec node node dist/main.js
fi
exec node dist/main.js
