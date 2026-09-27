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

## Publicar na nuvem

O passo a passo está em [PUBLICAR-NUVEM.md](PUBLICAR-NUVEM.md). As telas vão para o Google Firebase Hosting, no plano Spark, em `https://captura7-5e1da.web.app` (o ID do projeto é `captura7-5e1da`). A API vai para o Render gratuito e o banco para o MongoDB Atlas. O CORS da API aceita `https://captura7-5e1da.web.app` e `https://captura7-5e1da.firebaseapp.com`. A URI do banco não entra no Git. O caminho neste computador continua em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

O termo cita o Google Firebase Hosting, o Render (servidor nos Estados Unidos) e o MongoDB Atlas (banco em São Paulo, no Brasil, AWS `sa-east-1`). A transferência internacional do art. 33 da LGPD fica no Render e, eventualmente, no Firebase Hosting. O texto final ainda precisa da revisão do Jurídico LGPD Dados, só do captura7. A ADR-011 registra isso.
