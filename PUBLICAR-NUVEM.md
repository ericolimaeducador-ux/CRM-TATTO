# Publicar o captura7 na nuvem

Este guia é para o Erico, pessoa física, sem CNPJ e sem ERP. As telas ficam no GitHub Pages, o servidor no Render e o banco no MongoDB Atlas. O caminho neste computador continua em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

Não cole usuário, senha nem a URI do banco em arquivo do projeto, em conversa ou em print. Esses valores ficam só no gerenciador de senhas e nas variáveis secretas do Render.

O repositório é privado. O GitHub Pages de repositório privado exige GitHub Pro. Sem o Pro, o Pages não publica. Este guia não liga nenhuma configuração sozinho: os cliques abaixo são seus.

## 1. MongoDB Atlas

O cluster gratuito já existe. O host é `cluster0.tbl9r9u.mongodb.net`.

1. Entre em [cloud.mongodb.com](https://cloud.mongodb.com) e abra o projeto do cluster.
2. Em **Database Access**, crie um usuário do banco. Anote o nome. Troque a senha por uma senha nova e guarde no gerenciador de senhas. Não use a senha de exemplo da tela.
3. Em **Network Access**, adicione o endereço `0.0.0.0/0`. O Render no plano gratuito não tem IP fixo: o servidor acorda em máquinas diferentes e uma lista de IPs certos não se mantém. A senha do usuário do banco é o que impede um estranho de entrar. Não publique essa senha.
4. Em **Database**, **Connect**, escolha **Drivers**. A URI tem este formato, com o nome do banco `captura7` antes do ponto de interrogação:

   `mongodb+srv://<usuario>:<senha>@cluster0.tbl9r9u.mongodb.net/captura7`

   Troque `<usuario>` e `<senha>` pelos valores do passo 2. Se a senha tiver caracteres como `@`, `#` ou `:`, troque por o código que o Atlas mostra na própria tela de conexão. Guarde a URI inteira no gerenciador de senhas. Ela é o valor de `MONGO_URI`. Não a commite.

## 2. Render

1. Crie a conta em [render.com](https://render.com) e conecte o GitHub, autorizando o repositório `ericolimaeducador-ux/CRM-TATTO`.
2. **New** e depois **Blueprint**. Aponte para esse repositório. O arquivo `render.yaml` descreve o serviço `captura7-api`: plano free, região Oregon, build com pnpm, start `node dist/main.js` e saúde em `/v1/saude`.
3. O Render pede as variáveis com cadeado (`sync: false`). Preencha:

   - `MONGO_URI`: a URI do passo 1, só no campo secreto.
   - `CONTROLADOR_EMAIL`: o e-mail que aparece no termo.
   - `CORS_ORIGENS`: exatamente `https://ericolimaeducador-ux.github.io`, sem caminho e sem barra no fim.
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

## 4. GitHub Pages

1. Confirme o GitHub Pro na conta dona do repositório. Sem ele, Pages de repositório privado não funciona.
2. No repositório, **Settings**, **Pages**, em **Build and deployment** escolha a fonte **GitHub Actions**. Não escolha a pasta `main` / `docs`.
3. **Settings**, **Secrets and variables**, **Actions**, aba **Variables**. Crie `VITE_API_URL` com o endereço do Render, sem barra no fim. Exemplo de formato: `https://captura7-api.onrender.com`.
4. **Actions**, workflow **pages**, **Run workflow**. Ele instala, faz o build com a base `/CRM-TATTO/` e publica. O endereço das telas é `https://ericolimaeducador-ux.github.io/CRM-TATTO/`.
5. Se o workflow falhar dizendo que o Pages não está habilitado, volte ao passo 2. O workflow não roda sozinho a cada commit, para não ficar vermelho antes do Pro e do Pages.

## 5. Instalar no Android

No Chrome do celular, abra `https://ericolimaeducador-ux.github.io/CRM-TATTO/`. Menu, **Instalar aplicativo**. O certificado é o do GitHub. Não instale a CA local neste modo.

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
- O Atlas gratuito é compartilhado e pequeno (cerca de 512 MB). A rede aberta `0.0.0.0/0` existe porque o Render não tem IP fixo.
- O Pages privado depende do GitHub Pro. As telas são arquivos estáticos. A API é o único lugar que fala com o banco.
- A chave e o pepper não podem mudar. Se o serviço reiniciar sem eles, ele para em vez de inventar outros.
- Quem preferir o computador, sem essas contas, segue o [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md). Nesse caminho a CA local continua necessária no celular.
