# Publicar o captura7 na nuvem

Este guia é para o Erico, pessoa física, sem CNPJ e sem ERP. As telas ficam no Google Firebase Hosting, o servidor no Render e o banco no MongoDB Atlas. O aplicativo abre na raiz do domínio, no endereço `https://<projeto>.web.app`. O caminho neste computador continua em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

Não cole usuário, senha nem a URI do banco em arquivo do projeto, em conversa ou em print. Esses valores ficam só no gerenciador de senhas e nas variáveis secretas do Render. O JSON da conta de serviço do Firebase também não entra no Git.

## 1. MongoDB Atlas

O cluster gratuito já existe. O host é `cluster0.tbl9r9u.mongodb.net`. A senha que você já usa continua.

1. Entre em [cloud.mongodb.com](https://cloud.mongodb.com) e abra o projeto do cluster.
2. Em **Database Access**, use o usuário do banco que você já criou. A senha atual permanece. Guarde-a no gerenciador de senhas se ainda não estiver lá. Não publique essa senha.
3. Em **Network Access**, deixe o endereço `0.0.0.0/0`. O Render no plano gratuito não tem IP fixo: o servidor acorda em máquinas diferentes e uma lista de IPs certos não se mantém. A senha do usuário do banco é o que impede um estranho de entrar.
4. Em **Database**, **Connect**, escolha **Drivers**. A URI tem este formato, com o nome do banco `captura7` antes do ponto de interrogação:

   `mongodb+srv://<usuario>:<senha>@cluster0.tbl9r9u.mongodb.net/captura7`

   Use o usuário e a senha atuais. Se a senha tiver caracteres como `@`, `#` ou `:`, use o código que o Atlas mostra na própria tela de conexão. Guarde a URI inteira no gerenciador de senhas. Ela é o valor de `MONGO_URI`. Não a commite e não a cole neste repositório.

## 2. Render

1. Crie a conta em [render.com](https://render.com) e conecte o GitHub, autorizando o repositório `ericolimaeducador-ux/CRM-TATTO`.
2. **New** e depois **Blueprint**. Aponte para esse repositório. O arquivo `render.yaml` descreve o serviço `captura7-api`: plano free, região Oregon, build com pnpm, start `node dist/main.js` e saúde em `/v1/saude`.
3. O Render pede as variáveis com cadeado (`sync: false`). Preencha:

   - `MONGO_URI`: a URI do passo 1, só no campo secreto.
   - `CONTROLADOR_EMAIL`: o e-mail que aparece no termo.
   - `CORS_ORIGENS`: as duas origens do Firebase, separadas por vírgula, sem barra no fim. Troque `<projeto>` pelo ID do projeto do passo 4:

     `https://<projeto>.web.app,https://<projeto>.firebaseapp.com`

   - `CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER`: gere agora, no seu computador, com o Node instalado. Rode o comando duas vezes e guarde cada resultado no gerenciador de senhas. O primeiro é a chave. O segundo é o pepper. Não troque esses valores depois: a API em produção não gera outros, e um valor novo deixaria os dados cifrados ilegíveis.

   ```
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. Confirme o Blueprint. O endereço do serviço fica parecido com `https://captura7-api.onrender.com`. Anote o endereço real, sem barra no fim. Esse é o valor de `VITE_API_URL`.
5. As outras variáveis já vêm no Blueprint: `NODE_ENV=production`, `CAPTURA7_TRUST_PROXY_SALTOS=1`, retenção de 24 meses, 30 dias depois da revogação e 180 dias de rascunho. Não crie `SEGREDOS_ARQUIVO`. No Render não há disco permanente para esse arquivo.

## 3. Criar o administrador

O plano gratuito do Render pode não mostrar **Shell** no serviço. Se o Shell existir, abra-o e, com as variáveis do serviço já presentes, rode:

```
ADMIN_LOGIN=erico ADMIN_SENHA='uma senha de 12 ou mais' pnpm criar-admin
```

Se não houver Shell, rode no seu computador, na pasta do projeto, apontando para o Atlas. Cole a URI e os segredos a partir do gerenciador de senhas, nesta janela do PowerShell, sem gravar em arquivo:

```
$env:MONGO_URI = 'cole a URI aqui'
$env:CIFRA_CHAVE_BASE64 = 'cole a chave aqui'
$env:CIFRA_PEPPER = 'cole o pepper aqui'
$env:ADMIN_LOGIN = 'erico'
$env:ADMIN_SENHA = 'uma senha de 12 ou mais'
pnpm criar-admin
```

O comando cria o usuário no banco e não troca a senha se o login já existe. Feche a janela depois. Não deixe a URI no histórico se o seu PowerShell guardar comandos: apague a linha do histórico ou use uma janela que você feche em seguida.

Entre em `/entrar` quando as telas estiverem no ar e ative o autenticador: primeiro **Inscrever autenticador**, depois um código válido em **Ativar autenticador**.

## 4. Firebase Hosting

O plano é o **Spark**, o gratuito. O aplicativo fica na raiz do site. Não há pasta `/CRM-TATTO/` nem arquivo `404.html`.

1. Abra [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto. Anote o **ID do projeto**. Ele não é o nome bonito da tela. Os endereços serão `https://<id>.web.app` e `https://<id>.firebaseapp.com`.
2. No arquivo `.firebaserc`, troque o placeholder `captura7-substitua-o-id` por esse ID. O ID não é senha. Pode entrar no Git. Não troque por uma URI nem por um JSON de conta.
3. No console, em **Hosting**, ative o Hosting (Get started). Pode fechar o assistente sem colar comando nenhum: o deploy deste repositório é o workflow.
4. Gere o acesso do GitHub Actions. No console, **Configurações do projeto**, **Contas de serviço**, **Gerar nova chave privada**. O download é um JSON. No GitHub, no repositório, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. O nome é exatamente `FIREBASE_SERVICE_ACCOUNT`. O valor é o JSON inteiro. Apague o arquivo do computador depois de colar. Não o commite.

   O outro caminho, se preferir a ferramenta do Firebase no computador, é `firebase init hosting:github`. Ela também cria o secret. O workflow que vale é o arquivo `.github/workflows/firebase.yml` que já está no repositório. Não substitua esse arquivo por outro gerado na hora.

5. Na mesma página do GitHub, aba **Variables**, crie `VITE_API_URL` com o endereço do Render, sem barra no fim. Exemplo de formato: `https://captura7-api.onrender.com`.
6. O workflow **firebase** publica sozinho em cada push na `main`, e também quando você abre **Actions**, **firebase**, **Run workflow**. Enquanto o secret não existir, ele mostra um aviso e pula o deploy. O check não fica vermelho por isso. Depois que o secret e o ID do `.firebaserc` estiverem certos, um push na `main` ou o **Run workflow** publica as telas.
7. Abra `https://<id>.web.app`. A raiz do site é o captura7.

## 5. Instalar no Android

No Chrome do celular, abra `https://<id>.web.app`. Menu, **Instalar aplicativo**. O certificado é o do Firebase. Não instale a CA local neste modo.

Na primeira abertura do dia o Render pode estar dormindo. A tela mostra **Servidor acordando, aguarde…** e tenta de novo. O que você já digitou neste aparelho continua guardado aqui.

## 6. Backup do Atlas

De vez em quando, no seu computador, com o `mongodump` instalado (ele vem com as Database Tools do MongoDB), cole a URI só na variável e rode:

```
$env:MONGO_URI = 'cole a URI do gerenciador'
mongodump --uri="$env:MONGO_URI" --archive=captura7.archive.gz --gzip
```

Guarde o arquivo `captura7.archive.gz` fora do projeto, num pen drive ou numa pasta que não entra no Git. Apague a variável ao terminar. O plano gratuito do Atlas não substitui essa cópia.

## Limitações do plano gratuito

- O Render dorme depois de um tempo parado. A primeira chamada pode levar cerca de um minuto. Não há IP fixo, o disco some a cada deploy e o Shell pode não existir. Há um teto de horas no mês.
- O Atlas gratuito é compartilhado e pequeno (cerca de 512 MB). A rede aberta `0.0.0.0/0` existe porque o Render não tem IP fixo. A senha atual do banco continua sendo a proteção. A URI não vai para o repositório.
- O Firebase Hosting no plano Spark publica as telas estáticas nos dois endereços (`web.app` e `firebaseapp.com`). A API é o único lugar que fala com o banco.
- A chave e o pepper não podem mudar. Se o serviço reiniciar sem eles, ele para em vez de inventar outros.
- Quem preferir o computador, sem essas contas, segue o [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md). Nesse caminho a CA local continua necessária no celular.
