#!/usr/bin/env bash
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

falhou=0
varrer() {
  local padrao="$1"
  local descricao="$2"
  local saida
  saida="$(git grep -nE -I -e "$padrao" -- . ':!infra/ci/varrer-segredos.sh' ':!.env.example' ':!pnpm-lock.yaml' || true)"
  if [ -n "$saida" ]; then
    echo "Possível segredo (${descricao}):"
    echo "$saida"
    falhou=1
  fi
}

varrer 'AKIA[0-9A-Z]{16}' 'chave AWS'
varrer '-----BEGIN [A-Z ]*PRIVATE KEY-----' 'chave privada'
varrer 'mongodb(\+srv)?:\/\/[^:]+:[^@]+@' 'URI Mongo com senha'
varrer 'ghp_[A-Za-z0-9]{20,}' 'token GitHub'
varrer 'xox[baprs]-[A-Za-z0-9-]{10,}' 'token Slack'
varrer 'AIza[0-9A-Za-z_-]{35}' 'chave Google'

if [ "$falhou" -ne 0 ]; then
  exit 1
fi

echo '{"nivel":"INFO","evento":"varredura_segredos","resultado":"limpa"}'
