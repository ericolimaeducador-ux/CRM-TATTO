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

`CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER` não têm valor no repositório. Em `NODE_ENV=development` o entrypoint gera os dois na memória do processo e registra `segredo_efemero_dev`. O valor morre com o container. Em `production` a API recusa subir se algum dos dois faltar. O arquivo versionado é só `.env.example`, com placeholders.

## Backup

`node infra/backup/backup-321.mjs` cifra um dump lógico (AES-256-GCM), restaura numa base Mongo limpa e confere contagem e uma linha de `contatos_auditoria`. Sem `MONGO_URI` o ensaio sobe dois `mongod` em memória. `BACKUP_CHAVE` (32 bytes em base64) e `BACKUP_DIR` vêm do ambiente. Sem chave, a execução gera uma chave que morre com o processo e não é impressa.

Ensaio neste host em 2026-09-26, com 1 contato e 1 linha de auditoria, chave efêmera, relógio de `Date.now()`:

- RPO medido: 29 ms (da escrita mais nova até o arquivo cifrado fechado)
- RTO medido: 19 ms (do início da restauração até a amostra da trilha conferir)
- Ensaio anterior, no mesmo host e no mesmo volume: RPO 26 ms, RTO 15 ms
- Contagens iguais e amostra da auditoria conferida

Isso não é RTO/RPO de produção. A regra 3-2-1 **não está atendida**: há a base de origem e o arquivo cifrado no disco local; não há segunda mídia física nem cópia fora do local. `BACKUP_REMOTO_DESTINO` vazio não envia nada. Falta a conta de object storage do dono (URL `s3://` ou `b2://` e credencial fora do repositório).

## Docker neste ambiente

O arquivo Compose declara `mongo` como hostname, healthcheck e `depends_on` com `service_healthy`. Não achei nele a causa da ressalva da fase 0. Aqui o cliente Docker recebeu `permission denied` em `/var/run/docker.sock`, então `docker compose up` não rodou de novo. A ressalva da fase 0 continua: naquele host o `iptables-legacy` tinha FORWARD em DROP e a liberação do bridge não está no repositório.

## Fila de sincronização

`GET /v1/saude` devolve `filaSincronizacao`. `registrarProfundidadeFila` emite `WARN` `fila_sincronizacao_crescendo` quando a profundidade sobe. A fila em si chega na Fase 1; hoje o valor permanece 0. Isso não é alerta de produção ligado.

## Se a API não alcançar o Mongo

O healthcheck do `mongo` roda dentro do próprio container. Se a API registrar `Server selection timed out`, o processo não está completando TCP na porta 27017. Neste host o `iptables-legacy` estava com a cadeia FORWARD em DROP e não aceitava o bridge do Compose, enquanto o daemon tinha escrito a liberação no nftables. Isso é do host, não do arquivo Compose.

## CI

`.github/workflows/ci.yml` roda lint, build, migração contra MongoDB 7 e testes. O job fica vermelho se um passo falha. A trava de merge no GitHub (branch protection exigindo este check) não é configurável só com o arquivo do workflow.
