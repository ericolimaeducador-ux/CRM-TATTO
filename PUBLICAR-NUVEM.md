# Publicar o captura7 na nuvem

Este guia é para o Erico, pessoa física, sem CNPJ e sem ERP. As telas ficam no Google Firebase Hosting. A API fica no Google Cloud Run, no mesmo projeto, região São Paulo (`southamerica-east1`). O banco continua no MongoDB Atlas. O aplicativo abre em `https://<projeto>.web.app`. O caminho neste computador continua em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

Não cole usuário, senha, URI do banco, chave, pepper nem JSON de conta de serviço em arquivo do projeto, em conversa ou em print. Esses valores ficam no gerenciador de senhas e no Secret Manager.

No modo principal, `VITE_API_URL` fica vazio. O Hosting reescreve `/v1/**` para o Cloud Run. O celular chama a API no mesmo endereço das telas. O login segue no cabeçalho `Authorization`. A alternativa de URL direta está no fim do passo 5.

## 1. MongoDB Atlas

O cluster já existe. O host é `cluster0.tbl9r9u.mongodb.net`. A senha que você já usa continua. Não a troque por causa desta publicação.

1. Entre em [cloud.mongodb.com](https://cloud.mongodb.com) e abra o cluster.
2. Anote a **região** que o painel mostra (o mapa ou o nome da região na ficha do cluster). O termo usa essa região, a que você vê aí. Não invente outra.
3. Em **Database Access**, use o usuário que você já criou. A senha atual permanece no gerenciador de senhas.
4. Em **Network Access**, deixe `0.0.0.0/0`. O Cloud Run sai para a internet por endereços que mudam. Não há um IP fixo para colocar numa lista. A senha do usuário do banco é o que impede um estranho de entrar.

   Opção paga, se um dia quiser fechar essa rede: um Cloud NAT com IP estático na mesma região, e a saída do Cloud Run por esse NAT. Aí o Network Access do Atlas recebe só esse IP. O NAT cobra o endereço e a hora do gateway. Este guia segue com `0.0.0.0/0`.

5. Em **Database**, **Connect**, **Drivers**, monte a URI com o banco `captura7` antes do ponto de interrogação:

   `mongodb+srv://<usuario>:<senha>@cluster0.tbl9r9u.mongodb.net/captura7`

   Use o usuário e a senha atuais. Se a senha tiver `@`, `#` ou `:`, use o código que o Atlas mostra na tela de conexão. Guarde a URI no gerenciador de senhas. Ela é o `MONGO_URI`. Não a commite.

## 2. Plano Blaze, alerta e APIs

O Cloud Run pede o plano **Blaze** (pagamento por uso). O plano Spark não sobe Cloud Run. Com `min-instances=0` o serviço dorme e a franquia mensal do Cloud Run cobre um uso pessoal leve, mas o Blaze pode cobrar. Crie o alerta antes do primeiro deploy.

1. Abra [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto, ou abra o que já for seu. Anote o **ID do projeto**. Ele não é o nome bonito da tela. Os endereços serão `https://<id>.web.app` e `https://<id>.firebaseapp.com`.
2. No Firebase, atualize o projeto para o plano **Blaze**. Na hora de vincular o faturamento, no console do Google Cloud abra **Faturamento**, **Orçamentos e alertas**, e crie um alerta (por exemplo 50 reais) no e-mail que você lê. Assim um gasto fora do esperado avisa antes de crescer.
3. No arquivo `.firebaserc`, troque `captura7-substitua-o-id` por esse ID. O ID não é senha e pode entrar no Git. Não coloque URI nem JSON nesse arquivo.
4. No console do Firebase, em **Hosting**, ative o Hosting. Pode fechar o assistente sem colar comando.
5. Instale o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) no Windows, se ainda não tiver. Abra um PowerShell novo e entre:

   ```
   gcloud auth login
   gcloud config set project SEU_ID
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com iamcredentials.googleapis.com
   ```

   Troque `SEU_ID` pelo ID do projeto. Essas APIs são Cloud Run, Artifact Registry, Secret Manager, Cloud Scheduler, Cloud Build e a credencial usada pelo GitHub.

## 3. Segredos

Gere três valores no PowerShell, um comando por vez. Guarde cada um no gerenciador de senhas com um rótulo (chave, pepper, token de retenção). Não os troque depois: a chave e o pepper decifram os documentos. O token autoriza o job diário de retenção.

```
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
```

Crie os segredos. Em cada `versions add`, cole o valor, tecle Enter, depois Ctrl+Z e Enter para encerrar. Não grave esses valores num arquivo do projeto.

```
gcloud secrets create MONGO_URI --replication-policy="automatic"
gcloud secrets versions add MONGO_URI --data-file=-
gcloud secrets create CIFRA_CHAVE_BASE64 --replication-policy="automatic"
gcloud secrets versions add CIFRA_CHAVE_BASE64 --data-file=-
gcloud secrets create CIFRA_PEPPER --replication-policy="automatic"
gcloud secrets versions add CIFRA_PEPPER --data-file=-
gcloud secrets create RETENCAO_TOKEN --replication-policy="automatic"
gcloud secrets versions add RETENCAO_TOKEN --data-file=-
```

`CONTROLADOR_EMAIL` não é segredo. Ele entra como variável normal no deploy (passo 5), com o e-mail que o termo mostra. As retenções também são variáveis normais: 24 meses, 30 dias depois da revogação, 180 dias de rascunho. O workflow já manda esses números.

Anote o número do projeto, para a conta que lê os segredos:

```
gcloud projects describe SEU_ID --format="value(projectNumber)"
```

Troque `NUMERO` abaixo. Repita a política para os quatro segredos (`MONGO_URI`, `CIFRA_CHAVE_BASE64`, `CIFRA_PEPPER`, `RETENCAO_TOKEN`):

```
gcloud secrets add-iam-policy-binding MONGO_URI --member="serviceAccount:NUMERO-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

## 4. Autenticação do GitHub

O workflow `.github/workflows/nuvem.yml` prefere a **Workload Identity Federation**. A chave JSON é a alternativa. Sem nenhum dos dois, o workflow avisa e pula o deploy. O check `verificar` não fica vermelho por isso.

No GitHub, no repositório, **Settings**, **Secrets and variables**, **Actions**, aba **Variables**, crie:

- `GCP_PROJECT_ID`: o ID do projeto.
- `CONTROLADOR_EMAIL`: o e-mail do termo.
- `VITE_API_URL`: deixe vazia neste modo. O site chama `/v1` no mesmo endereço.

### Federação (preferida)

Ainda no PowerShell, com `SEU_ID` e o `NUMERO` do passo 3:

```
gcloud iam service-accounts create captura7-deploy --display-name="Deploy captura7"
gcloud projects add-iam-policy-binding SEU_ID --member="serviceAccount:captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/run.admin"
gcloud projects add-iam-policy-binding SEU_ID --member="serviceAccount:captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/artifactregistry.admin"
gcloud projects add-iam-policy-binding SEU_ID --member="serviceAccount:captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding SEU_ID --member="serviceAccount:captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/secretmanager.admin"
gcloud projects add-iam-policy-binding SEU_ID --member="serviceAccount:captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/firebasehosting.admin"
gcloud iam workload-identity-pools create github --location="global" --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc github --location="global" --workload-identity-pool="github" --display-name="GitHub" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" --issuer-uri="https://token.actions.githubusercontent.com"
gcloud iam service-accounts add-iam-policy-binding "captura7-deploy@SEU_ID.iam.gserviceaccount.com" --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/NUMERO/locations/global/workloadIdentityPools/github/attribute.repository/ericolimaeducador-ux/CRM-TATTO"
```

Nas **Variables** do GitHub:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/NUMERO/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_SERVICE_ACCOUNT`: `captura7-deploy@SEU_ID.iam.gserviceaccount.com`

### Alternativa: chave JSON

Se preferir a chave, no console: **IAM**, conta `captura7-deploy`, **Chaves**, **Adicionar chave**, JSON. No GitHub, **New repository secret**, nome exatamente `GCP_SA_KEY`, valor o JSON inteiro. Apague o arquivo do computador. Não o commite. Com a federação preenchida, o workflow ignora esta chave.

## 5. Primeiro deploy

O serviço se chama `captura7-api`, o mesmo `serviceId` do `firebase.json`. Região `southamerica-east1`. Porta 8080. `min-instances=0`, `max-instances=2`, memória `512Mi` (o processo Nest com o cliente do Mongo precisa disso para subir; 256Mi costuma morrer no arranque).

### Pelo GitHub

O workflow **nuvem** roda em cada push na `main` e em **Actions**, **nuvem**, **Run workflow**. Ele constrói a imagem, envia ao Artifact Registry, publica o Cloud Run e depois o Hosting. Confira o ID no `.firebaserc` ou a variável `GCP_PROJECT_ID` antes. Com o placeholder `captura7-substitua-o-id` e sem a variável, o job avisa e pula.

### Pelo Windows, se preferir a linha de comando

Na pasta do repositório, com o Docker Desktop aberto:

```
gcloud artifacts repositories create captura7 --repository-format=docker --location=southamerica-east1 --description="Imagem da API do captura7"
gcloud auth configure-docker southamerica-east1-docker.pkg.dev
docker build -f apps/api/Dockerfile -t southamerica-east1-docker.pkg.dev/SEU_ID/captura7/api:manual .
docker push southamerica-east1-docker.pkg.dev/SEU_ID/captura7/api:manual
```

Sem Docker no computador, o Cloud Build sobe a mesma imagem. Se o build reclamar de permissão para enviar a imagem, dê `roles/artifactregistry.writer` à conta que o log mostrar.

```
gcloud builds submit --config=cloudbuild.yaml --substitutions=_IMAGEM=southamerica-east1-docker.pkg.dev/SEU_ID/captura7/api:manual --region=southamerica-east1
```

Depois, nos dois caminhos, publique o serviço. Troque o e-mail. Não crie `SEGREDOS_ARQUIVO`.

```
gcloud run deploy captura7-api --image=southamerica-east1-docker.pkg.dev/SEU_ID/captura7/api:manual --region=southamerica-east1 --platform=managed --port=8080 --min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --allow-unauthenticated --set-secrets="MONGO_URI=MONGO_URI:latest,CIFRA_CHAVE_BASE64=CIFRA_CHAVE_BASE64:latest,CIFRA_PEPPER=CIFRA_PEPPER:latest,RETENCAO_TOKEN=RETENCAO_TOKEN:latest" --set-env-vars="NODE_ENV=production,CAPTURA7_TRUST_PROXY_SALTOS=1,RETENCAO_MESES=24,PURGA_REVOGACAO_DIAS=30,RASCUNHO_DIAS=180,RETENCAO_TIMER=0,CONTROLADOR_EMAIL=seu@email"
```

As telas, ainda na pasta do repositório:

```
npm install -g firebase-tools
firebase login
$env:VITE_API_URL = ''
pnpm install
pnpm --filter @captura7/web build
firebase deploy --only hosting --project SEU_ID
```

Abra `https://<id>.web.app`. A raiz é o captura7. A API responde em `https://<id>.web.app/v1/saude`.

### URL direta, se um dia precisar

Deixe o rewrite como está. Pegue o endereço do serviço:

```
gcloud run services describe captura7-api --region=southamerica-east1 --format="value(status.url)"
```

Coloque essa URL, sem barra no fim, na variável `VITE_API_URL` e gere o site de novo. Crie também a variável `CORS_ORIGENS` com as duas origens, sem barra no fim:

`https://<id>.web.app,https://<id>.firebaseapp.com`

Sem essa lista, o navegador em outro domínio não chama a API. No modo com `VITE_API_URL` vazia essa lista não é necessária.

## 6. Criar o administrador

O script grava o usuário no Atlas. Ele não lê a chave nem o pepper. A API continua usando os valores do Secret Manager. Não gere outra chave para este passo.

No PowerShell, na pasta do projeto, cole a partir do gerenciador de senhas e feche a janela depois:

```
$env:MONGO_URI = 'cole a URI aqui'
$env:ADMIN_LOGIN = 'erico'
$env:ADMIN_SENHA = 'uma senha de 12 ou mais'
pnpm criar-admin
```

O comando não troca a senha se o login já existe. Apague a linha do histórico do PowerShell se ele guardar comandos.

A outra forma é um Cloud Run Job com a mesma imagem. Crie um segredo `ADMIN_SENHA` só para isso (o mesmo jeito do passo 3) e apague o segredo depois que o usuário existir.

```
gcloud run jobs create captura7-criar-admin --image=southamerica-east1-docker.pkg.dev/SEU_ID/captura7/api:manual --region=southamerica-east1 --set-secrets="MONGO_URI=MONGO_URI:latest,ADMIN_SENHA=ADMIN_SENHA:latest" --set-env-vars="ADMIN_LOGIN=erico" --command=node --args=scripts/criar-admin.mjs --task-timeout=180 --max-retries=0
gcloud run jobs execute captura7-criar-admin --region=southamerica-east1 --wait
```

Entre em `https://<id>.web.app/entrar` e ative o autenticador: **Inscrever autenticador**, depois um código válido em **Ativar autenticador**.

## 7. Retenção diária

Com `min-instances=0` o relógio de dentro do processo não roda todo dia, porque a instância desliga. O caminho confiável é o Cloud Scheduler chamando `POST /v1/interno/retencao` com o cabeçalho `X-Retencao-Token`. O token é o do Secret Manager. A API compara em tempo constante. Token errado não apaga nada.

Se o console pedir um aplicativo do App Engine para o Scheduler existir, crie-o em `southamerica-east1`. O captura7 não usa esse aplicativo.

```
gcloud scheduler jobs create http captura7-retencao --location=southamerica-east1 --schedule="15 7 * * *" --time-zone="America/Sao_Paulo" --uri="URL_DO_CLOUD_RUN/v1/interno/retencao" --http-method=POST --headers="X-Retencao-Token=COLE_O_TOKEN" --attempt-deadline=180s
```

`URL_DO_CLOUD_RUN` é a saída do `gcloud run services describe` do passo 5, sem barra no fim. O mesmo POST em `https://<id>.web.app/v1/interno/retencao` também chega na API, pelo rewrite. Cole o token a partir do gerenciador de senhas. Não o deixe no repositório.

## 8. Instalar no Android

No Chrome do celular, abra `https://<id>.web.app`. Menu, **Instalar aplicativo**. O certificado é o do Firebase. Não instale a CA local neste modo.

Na primeira abertura depois de um tempo parado o Cloud Run pode estar frio. A tela mostra **Servidor acordando, aguarde…** e tenta de novo. O que você já digitou neste aparelho continua guardado aqui.

## 9. Backup do Atlas

De vez em quando, com o `mongodump` instalado (Database Tools do MongoDB), cole a URI só na variável:

```
$env:MONGO_URI = 'cole a URI do gerenciador'
mongodump --uri="$env:MONGO_URI" --archive=captura7.archive.gz --gzip
```

Guarde `captura7.archive.gz` fora do projeto, num pen drive ou numa pasta que não entra no Git. Apague a variável ao terminar. O plano gratuito do Atlas não substitui essa cópia.

## Limitações

- O projeto está no Blaze. O alerta de orçamento é o aviso de gasto. `min-instances=0` desliga a API parada. A primeira chamada pode levar perto de um minuto. No máximo 2 instâncias. A memória é 512Mi. O disco do container some a cada deploy.
- Não há IP fixo. Por isso o Atlas usa `0.0.0.0/0`, com a senha atual do banco. O NAT estático é a opção paga.
- O Atlas gratuito é compartilhado e pequeno (cerca de 512 MB). A URI não vai para o repositório.
- A chave e o pepper não podem mudar. Se o serviço subir sem eles, ele para em vez de inventar outros.
- A retenção diária depende do Cloud Scheduler. O relógio interno fica desligado no Cloud Run (`RETENCAO_TIMER=0`) e continua no Docker deste computador.
- Quem preferir o computador, sem essas contas, segue o [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md). Nesse caminho a CA local continua necessária no celular.
