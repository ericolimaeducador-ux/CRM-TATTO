# captura7

Uso pessoal no computador do controlador. O passo a passo no Windows está em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

## Backup do Mongo

O ensaio cifrado `infra/backup/backup-321.mjs` continua separado e ainda não tem bucket remoto.

Para uma cópia simples com `mongodump`:

```
MONGO_URI=mongodb://127.0.0.1:27017/captura7 sh infra/backup/backup-mongo.sh
```

No Docker Desktop, sem instalar o `mongodump` no Windows:

```
docker compose exec mongo mongodump --db captura7 --archive=/tmp/captura7.archive.gz --gzip
docker compose cp mongo:/tmp/captura7.archive.gz .\captura7.archive.gz
```

Leve o arquivo `captura7.archive.gz` para um pen drive ou para outro computador. Apagar só o disco deste PC apaga a base e essa cópia se ela ficou na mesma máquina.

Para abrir a cópia numa base vazia:

```
mongorestore --uri="mongodb://127.0.0.1:27017" --archive=captura7.archive.gz --gzip --nsInclude="captura7.*"
```

## Site no GitHub Pages

O workflow `.github/workflows/pages.yml` publica só o site estático em `https://ericolimaeducador-ux.github.io/CRM-TATTO/`. A API e o MongoDB não rodam no Pages: continuam no computador do controlador.

O build usa `PAGES_BASE=/CRM-TATTO/`. A variável de repositório `VITE_API_URL`, se existir, entra no JavaScript. Vazia, o site chama `/v1` no próprio Pages e a API não responde. Quando a API tiver endereço público, grave `VITE_API_URL` sem barra no fim e `CORS_ORIGENS` na API com a origem exata `https://ericolimaeducador-ux.github.io`.

O Compose local continua com `VITE_API_URL` vazio, então neste computador o site chama `/v1` no mesmo endereço. O termo continua descrevendo o computador local. O Pages entrega o aplicativo; não guarda a base de contatos.
