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

## Publicar depois, sem decidir agora

Hoje o site e a API sobem juntos neste computador. O repositório não publica em lugar nenhum e não tem workflow de deploy.

Se um dia o site for para o GitHub Pages e a API para um serviço com MongoDB Atlas:

1. Na API, defina `MONGO_URI` com a string do Atlas (usuário e senha fora do Git) e `CORS_ORIGENS` com a origem exata do Pages, por exemplo `https://usuario.github.io`.
2. No build do site, defina `VITE_API_URL` com a URL pública da API, sem barra no fim, por exemplo `https://api.exemplo.com`. O Vite grava esse valor no JavaScript. Vazio significa chamar `/v1` no mesmo endereço, que é o caso do Docker local.
3. O Compose já repassa `VITE_API_URL` vazio para a imagem do site e `CORS_ORIGENS` para a API. Não há passo de publicação automático.

O termo continua descrevendo o computador local. Mudar de hospedagem é outra decisão e pede revisão do texto legal.
