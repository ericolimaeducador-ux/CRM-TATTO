# Publicar o TattooArt na nuvem

Este guia é para o Erico, pessoa física, sem CNPJ e sem ERP. Tudo aqui é gratuito e não pede cartão. As telas ficam no Google Firebase Hosting, plano Spark. A API fica no Render, plano gratuito, nos Estados Unidos. O banco fica no MongoDB Atlas. O caminho neste computador continua em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

O plano Spark não encaminha `/v1` para o Render. As telas abrem em `https://captura7-5e1da.web.app` e a API em `https://<serviço>.onrender.com`. O login manda um token no cabeçalho `Authorization`. O celular guarda esse token neste aparelho e apaga quando você sai. Um cookie entre os dois endereços seria bloqueado pelo Chrome e pelo Safari.

Não cole usuário, senha nem a URI do banco em arquivo do projeto, em conversa ou em print. Esses valores ficam no gerenciador de senhas e nas variáveis secretas do Render. O JSON da conta de serviço do Firebase também não entra no Git.

## 1. Firebase Hosting

O plano é o **Spark**, o gratuito. Ele não pede cartão. O aplicativo fica na raiz do site.

1. O projeto já existe, no plano Spark. O ID é `captura7-5e1da`. Os endereços são `https://captura7-5e1da.web.app` e `https://captura7-5e1da.firebaseapp.com`.
2. O arquivo `.firebaserc` já guarda esse ID. Ele não é senha e pode ficar no Git. Não coloque URI nem JSON nesse arquivo.
3. No console, em **Hosting**, ative o Hosting. Pode fechar o assistente sem colar comando nenhum.
4. Gere o acesso do GitHub. No console, **Configurações do projeto**, **Contas de serviço**, **Gerar nova chave privada**. O download é um JSON. No GitHub, no repositório, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. O nome é exatamente `FIREBASE_SERVICE_ACCOUNT`. O valor é o JSON inteiro. Apague o arquivo do computador depois de colar. Não o commite.
5. A variável `VITE_API_URL` entra no passo 3, depois que o Render mostrar o endereço da API. Sem essa URL o site publicado não acha o servidor.

O ID do projeto `captura7-5e1da` não pode ser renomeado. O site que recebe as telas é outro ajuste, no mesmo projeto. O `firebase.json` usa o target `app`. O `.firebaserc` aponta esse target, hoje, para o site `captura7-5e1da`, que é o site padrão. Assim o deploy atual continua no endereço que já existe.

Quando você confirmar o nome exato de um site adicional (a ideia é um nome TattooArt no mesmo projeto), rode na pasta do projeto:

```
firebase target:apply hosting app NOME_DO_SITE
```

Troque `NOME_DO_SITE` pelo nome que o console do Hosting mostrar. Isso só muda o destino das telas. O projeto continua `captura7-5e1da`.

O `CORS_ORIGENS` é uma variável do Render, com cadeado. Para incluir o site novo, edite essa variável e salve. Não precisa mudar código. Separe as origens por vírgula, sem barra no fim. Pode manter as duas de hoje e acrescentar as do site novo:

`https://captura7-5e1da.web.app,https://captura7-5e1da.firebaseapp.com,https://NOME_DO_SITE.web.app,https://NOME_DO_SITE.firebaseapp.com`

O nome exato do site ainda será confirmado. Até lá, as telas seguem em `https://captura7-5e1da.web.app`.

O workflow **firebase** publica em cada push na `main` e também em **Actions**, **firebase**, **Run workflow**. Enquanto o secret não existir, ele mostra um aviso e pula o deploy. O check não fica vermelho por isso. O workflow usa o target `app`.

## 2. Render

1. Crie a conta em [render.com](https://render.com) com o GitHub e autorize o repositório `ericolimaeducador-ux/CRM-TATTO`. Escolha o plano gratuito. Não informe cartão.
2. **New** e depois **Blueprint**. Aponte para esse repositório. O arquivo `render.yaml` descreve o serviço `captura7-api`: plano free, região Oregon (Estados Unidos), build com pnpm, start `node dist/main.js`, saúde em `/v1/saude` e porta vinda de `PORT`.
3. O Render pede as variáveis com cadeado (`sync: false`). Preencha:

   - `MONGO_URI`: a URI do Atlas, no item 3, só no campo secreto. Se você ainda for montá-la, confirme o Blueprint e cole a URI depois, em **Environment**.
   - `CONTROLADOR_EMAIL`: o e-mail que aparece no termo.
   - `CORS_ORIGENS`: as duas origens do Firebase, separadas por vírgula, sem barra no fim:

     `https://captura7-5e1da.web.app,https://captura7-5e1da.firebaseapp.com`

   - `CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER`: gere agora, no seu computador, com o Node instalado. Rode o comando duas vezes e guarde cada resultado no gerenciador de senhas. O primeiro é a chave. O segundo é o pepper. Não troque esses valores depois: a API em produção não gera outros, e um valor novo deixaria os dados cifrados ilegíveis.

   ```
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
   ```

   - `RETENCAO_TOKEN`: rode o mesmo comando uma terceira vez. Guarde o resultado. Ele autoriza o disparo diário da retenção. Não é a senha do aplicativo.

4. Confirme o Blueprint. O endereço do serviço fica parecido com `https://captura7-api.onrender.com`. Anote o endereço real, sem barra no fim.
5. As outras variáveis já vêm no Blueprint: `NODE_ENV=production`, `CAPTURA7_TRUST_PROXY_SALTOS=1`, retenção de 24 meses, 30 dias depois da revogação e 180 dias de rascunho. Não crie `SEGREDOS_ARQUIVO`. No Render não há disco permanente para esse arquivo.
6. No GitHub, aba **Variables**, crie `VITE_API_URL` com o endereço do Render, sem barra no fim. Crie também `RENDER_API_URL` com o mesmo endereço. Na aba **Secrets**, crie `RETENCAO_TOKEN` com o mesmo token que você gerou acima. O workflow `retencao` usa esses dois uma vez por dia. Sem eles, avisa e pula.
7. Com o secret do Firebase e a `VITE_API_URL` preenchidos, um push na `main` ou **Run workflow** no workflow **firebase** publica as telas. Abra `https://captura7-5e1da.web.app`.

## 3. MongoDB Atlas

O cluster gratuito já existe. É o plano **M0** (FREE), na AWS, região **São Paulo** (`sa-east-1`). O host é `cluster0.tbl9r9u.mongodb.net`. O banco fica no Brasil.

1. Entre em [cloud.mongodb.com](https://cloud.mongodb.com) e abra o projeto do cluster.
2. Em **Database Access**, crie um usuário só para o aplicativo. **Add New Database User**, autenticação por senha. Guarde a senha no gerenciador de senhas. Em privilégios, escolha o específico: função `readWrite`, banco `captura7`. Esse usuário lê e grava só esse banco. O `atlasAdmin` administra o cluster inteiro e fica no painel. A URI do aplicativo usa o usuário novo, com `readWrite`.
3. Em **Network Access**, o endereço `0.0.0.0/0` já está liberado. Deixe assim. O Render no plano gratuito não tem IP fixo: o servidor acorda em máquinas diferentes e uma lista de IPs certos não se mantém. A senha do usuário `readWrite` é o que impede um estranho de entrar.
4. Em **Database**, **Connect**, escolha **Drivers**. A URI tem este formato, com o nome do banco `captura7` antes do ponto de interrogação:

   `mongodb+srv://<usuario>:<senha>@cluster0.tbl9r9u.mongodb.net/captura7`

   `<usuario>` é o usuário `readWrite` do item 2. Se a senha tiver caracteres como `@`, `#` ou `:`, use o código que o Atlas mostra na própria tela de conexão. Guarde a URI inteira no gerenciador de senhas. Ela é o valor de `MONGO_URI` do passo 2. Não a commite e não a cole neste repositório.

Se você ainda não preencheu o `MONGO_URI` no Render, volte ao serviço, abra **Environment** e cole a URI no campo secreto. Salve. O Render sobe de novo.

## 4. Criar o administrador

O plano gratuito do Render pode não mostrar **Shell** no serviço. Rode no seu computador, na pasta do projeto, apontando para o Atlas. A chave e o pepper são os mesmos que você colocou no Render: a API cifra com eles. O script do administrador não lê a chave. Cole a partir do gerenciador de senhas, nesta janela do PowerShell, sem gravar em arquivo:

```
$env:MONGO_URI = 'cole a URI aqui'
$env:ADMIN_LOGIN = 'erico'
$env:ADMIN_SENHA = 'uma senha de 12 ou mais'
pnpm criar-admin
```

O comando cria o usuário no banco e não troca a senha se o login já existe. Feche a janela depois. Não deixe a URI no histórico se o seu PowerShell guardar comandos: apague a linha do histórico ou use uma janela que você feche em seguida.

Entre em `https://captura7-5e1da.web.app/entrar` quando as telas estiverem no ar e ative o autenticador: primeiro **Inscrever autenticador**, depois um código válido em **Ativar autenticador**.

## 5. Retenção

O Render gratuito dorme. O relógio de dentro do processo para junto. Duas coisas cobrem o dia, sem cartão:

- Quando a API sobe, ela mesma roda a retenção.
- O workflow **retencao** do GitHub, uma vez por dia, chama `POST /v1/interno/retencao` com o cabeçalho `X-Retencao-Token`. O token é o secret `RETENCAO_TOKEN`. Token errado não apaga nada. Sem a variável `RENDER_API_URL` ou sem o secret, o workflow avisa e pula.

Você também pode disparar na mão: **Actions**, **retencao**, **Run workflow**.

## 6. Instalar no Android

No Chrome do celular, abra `https://captura7-5e1da.web.app`. Menu, **Instalar aplicativo**. O certificado é o do Firebase. Não instale a CA local neste modo.

Na primeira abertura do dia o Render pode estar dormindo. A tela mostra **Servidor acordando, aguarde…** e tenta de novo. O que você já digitou neste aparelho continua guardado aqui.

## 7. Backup do Atlas

De vez em quando, no seu computador, com o `mongodump` instalado (ele vem com as Database Tools do MongoDB), cole a URI só na variável e rode:

```
$env:MONGO_URI = 'cole a URI do gerenciador'
mongodump --uri="$env:MONGO_URI" --archive=captura7.archive.gz --gzip
```

Guarde o arquivo `captura7.archive.gz` fora do projeto, num pen drive ou numa pasta que não entra no Git. Apague a variável ao terminar. O plano gratuito do Atlas não substitui essa cópia.

## Limitações do plano gratuito

- O Render dorme depois de um tempo parado. A primeira chamada pode levar cerca de um minuto. Não há IP fixo, o disco some a cada deploy e o Shell pode não existir. O servidor fica nos Estados Unidos. Há um teto de horas no mês.
- O Atlas no plano M0 é compartilhado e pequeno (cerca de 512 MB), na AWS em São Paulo (`sa-east-1`). A rede `0.0.0.0/0` já está liberada porque o Render não tem IP fixo. A senha do usuário `readWrite` é a proteção. A URI não vai para o repositório.
- O Firebase Hosting no plano Spark publica as telas em `https://captura7-5e1da.web.app` e `https://captura7-5e1da.firebaseapp.com`. Não há cartão. A API é o único lugar que fala com o banco.
- A chave e o pepper não podem mudar. Se o serviço reiniciar sem eles, ele para em vez de inventar outros.
- Quem preferir o computador, sem essas contas, segue o [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md). Nesse caminho a CA local continua necessária no celular.
