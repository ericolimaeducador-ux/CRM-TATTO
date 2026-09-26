# Infra — captura7

Ambiente de desenvolvimento. Não é deploy de produção.

## Subir

Na raiz do repositório, com Docker instalado:

```
docker compose up --build
```

Sobe `mongo` (MongoDB 7), `api` (porta 127.0.0.1:3000) e `web` (porta 127.0.0.1:5173). Não exige `.env`.

## TLS

A câmera do captura7 exige HTTPS fora da máquina local. Este Compose publica as portas só em `127.0.0.1` e fala HTTP. `localhost` é a única exceção de TLS, e ela para aqui: qualquer host acessível por rede precisa de TLS antes de existir câmera. Isso não está neste card.

## Segredos

`CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER` não têm valor no repositório. A imagem final da API nasce com `NODE_ENV=production`. O Compose de desenvolvimento sobrescreve para `development`: aí o entrypoint gera os dois na memória do processo e registra `segredo_efemero_dev`. O valor morre com o container. Em `production` a API recusa subir se algum dos dois faltar. Pepper vazio, placeholder (`preencha-...`) ou com menos de 32 caracteres também é recusado na hora de cifrar. O arquivo versionado é só `.env.example`, com placeholders. Não há `JWT_SEGREDO`: nenhum código emite JWT.

## Backup

Backup 3-2-1, criptografia antes de sair do ambiente e restauração cronometrada são o card F3-04. Não há backup neste estágio. RTO e RPO de produção não estão declarados porque não existe backup a medir.

## Fila de sincronização

`GET /v1/saude` devolve `filaSincronizacao`. `registrarProfundidadeFila` emite `WARN` `fila_sincronizacao_crescendo` quando a profundidade sobe. A fila em si chega na Fase 1; hoje o valor permanece 0. Isso não é alerta de produção ligado.

## Se a API não alcançar o Mongo

O healthcheck do `mongo` roda dentro do próprio container. Se a API registrar `Server selection timed out`, o processo não está completando TCP na porta 27017. Neste host o `iptables-legacy` estava com a cadeia FORWARD em DROP e não aceitava o bridge do Compose, enquanto o daemon tinha escrito a liberação no nftables. Isso é do host, não do arquivo Compose.

## CI

`.github/workflows/ci.yml` roda lint, build, migração contra MongoDB 7 e testes. O job fica vermelho se um passo falha. A trava de merge no GitHub (branch protection exigindo este check) não é configurável só com o arquivo do workflow.
