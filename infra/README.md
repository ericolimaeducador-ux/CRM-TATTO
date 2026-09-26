# Infra — captura7

Uso pessoal no computador do controlador. O passo a passo para leigo no Windows está em [INSTALAR-WINDOWS.md](../INSTALAR-WINDOWS.md).

## Subir

Na raiz do repositório, com Docker instalado:

```
docker compose up --build
```

Sobe `mongo` (MongoDB 7, só em `127.0.0.1:27017`), `api` (`NODE_ENV=production`, só em `127.0.0.1:3000`) e `web` nas portas 80 e 443. O primeiro boot grava chave e pepper no volume `segredos` e não imprime os valores. Um `.env` ao lado do Compose só é necessário para `CONTROLADOR_EMAIL` e, se um dia existir, para a URL do webhook.

## TLS

O site do Compose escuta HTTPS com certificado autoassinado, gerado no volume `certs`. O celular na mesma rede aceita o aviso uma vez e então instala o PWA. A API não é publicada na rede: o nginx encaminha `/v1/` e grava só `$remote_addr` em `X-Forwarded-For`.

## Segredos

`CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER` não têm valor no repositório. A imagem da API nasce com `NODE_ENV=production`. No Compose, se o volume `segredos` ainda não tem o arquivo, o entrypoint gera os dois, grava com permissão 0600 e não imprime os valores. Pepper vazio, placeholder (`preencha-...`) ou com menos de 32 caracteres é recusado, e a chave precisa decodificar 32 bytes. O arquivo versionado é só `.env.example`, com placeholders. Não há `JWT_SEGREDO`: nenhum código emite JWT.

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
