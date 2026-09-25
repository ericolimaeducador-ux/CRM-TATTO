#!/bin/sh
set -eu
if [ -z "${CIFRA_CHAVE_BASE64:-}" ] || [ -z "${CIFRA_PEPPER:-}" ]; then
  if [ "${NODE_ENV:-development}" = "production" ]; then
    echo '{"nivel":"ERROR","evento":"segredo_ausente","mensagem":"CIFRA_CHAVE_BASE64 e CIFRA_PEPPER são obrigatórios em produção e não podem vir do repositório."}' >&2
    exit 1
  fi
  CIFRA_CHAVE_BASE64="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
  CIFRA_PEPPER="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
  export CIFRA_CHAVE_BASE64 CIFRA_PEPPER
  echo '{"nivel":"WARN","evento":"segredo_efemero_dev","mensagem":"Chave e pepper gerados só nesta execução de development. Não servem para produção nem sobrevivem a um container novo."}'
fi
exec node dist/main.js
