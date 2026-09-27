# Instalar o captura7 no Windows

Este guia é para usar o captura7 no seu computador. O aplicativo não precisa de empresa, CNPJ nem de internet de nuvem. Os dados ficam nesta máquina. Para publicar na nuvem, o outro caminho é [PUBLICAR-NUVEM.md](PUBLICAR-NUVEM.md). Este arquivo continua sendo a alternativa local.

Há dois caminhos. O primeiro usa o Docker Desktop e é o que instala o aplicativo no celular. O segundo usa Node e MongoDB, sem Docker.

## Antes de começar

- O computador e o celular precisam estar no mesmo Wi-Fi.
- Anote um e-mail seu. Ele aparece no termo de consentimento. Você vai colocá-lo na variável `CONTROLADOR_EMAIL`.
- Escolha um usuário e uma senha de administrador. A senha precisa ter 12 caracteres ou mais. Não grave a senha em arquivo do projeto.

## Caminho 1 — Docker Desktop

1. Instale o [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/). Abra o programa e espere ele dizer que está em execução.
2. Na primeira execução, o Windows pode pedir para reiniciar ou para liberar o WSL. Aceite.
3. Baixe esta pasta do projeto, ou clone o repositório, e abra o PowerShell dentro dela.
4. Crie um arquivo chamado `.env` na mesma pasta do `docker-compose.yml`, com uma linha:

   ```
   CONTROLADOR_EMAIL=seu-email@provedor.com
   ```

   Troque pelo seu e-mail. Se quiser outro prazo de guarda, acrescente `RETENCAO_MESES=24`. O padrão já é 24 meses sem interação. No mesmo arquivo, coloque o IP do Wi-Fi antes da primeira subida, para o certificado já nascer com esse endereço:

   ```
   CERT_IPS=192.168.0.20
   ```

   Troque pelo IPv4 que o `ipconfig` mostrar no adaptador do Wi-Fi. Vários IPs se separam por vírgula.

5. Suba o sistema:

   ```
   docker compose up --build
   ```

   Na primeira vez a API gera a chave e o pepper sozinha e guarda os dois num volume do Docker. Esses valores não aparecem na tela. Não apague o volume `segredos`: sem ele, os documentos já gravados deixam de abrir.

6. Espere as três partes ficarem saudáveis: banco, API e site. Deixe essa janela aberta.

7. O site usa uma autoridade certificadora local, não um certificado solto. Copie o arquivo da CA para a pasta do projeto:

   ```
   docker compose cp web:/certs/ca.crt .\ca.crt
   ```

   No PowerShell, instale essa CA no usuário do Windows:

   ```
   certutil -addstore -user Root .\ca.crt
   ```

   Feche e abra o navegador. `https://localhost` deve abrir sem aviso. Se você já tinha subido uma versão antiga, apague o certificado velho e suba de novo para a CA nascer:

   ```
   docker compose exec web rm -f /certs/captura7.crt /certs/captura7.key /certs/ca.crt /certs/ca.key
   docker compose restart web
   ```

   Se o IP mudou, apague só `captura7.crt` e `captura7.key`, ajuste `CERT_IPS` e reinicie o serviço `web`. A mesma CA assina o certificado novo.

8. Crie o administrador. Em outro PowerShell, na mesma pasta:

   ```
   docker compose exec -e ADMIN_LOGIN=erico -e ADMIN_SENHA=uma-senha-de-12 -e ADMIN_NOME="Erico Henrique de Lima Araujo" api node scripts/criar-admin.mjs
   ```

   Troque `erico` e a senha. Se o login já existir, o comando avisa e não troca a senha.

9. No navegador, toque em **Entrar**. Use o usuário e a senha. No primeiro acesso o administrador precisa tocar em **Inscrever autenticador** antes do resto da tela. Copie o segredo para um aplicativo de códigos de 6 dígitos. Nos próximos acessos o código é obrigatório para quem já inscreveu, inclusive vendedor, gestor e auditor. **Sair** encerra a sessão no servidor. **Trocar senha** pede a senha atual e uma nova com 12 ou mais caracteres. A exportação só funciona depois de **Confirmar passo extra**, e o passo vale cinco minutos. Os botões de exportar e importar só aparecem para quem tem essa permissão: exportar é do administrador; importar é de gestor ou administrador.

10. Descubra o IP do computador. No PowerShell:

    ```
    ipconfig
    ```

    Procure o adaptador do Wi-Fi e o número **Endereço IPv4**, parecido com `192.168.0.20`.

11. Se o Windows Firewall perguntar, permita o Docker nas redes privadas. Se o celular não abrir a página, em "Firewall do Windows Defender" libere as portas **80** e **443** para redes privadas.

12. Instale a mesma `ca.crt` no celular. Sem isso o navegador avisa e o aplicativo pode não funcionar offline. Um IP de rede local (`192.168.x.x`) não recebe certificado de uma autoridade pública, então não há como evitar a instalação da CA.

    **Android.** Copie `ca.crt` para o celular (cabo, Drive ou e-mail para você mesmo). Em Ajustes, Segurança, Criptografia e credenciais, toque em **Instalar um certificado** e escolha **Certificado CA**. Confirme a instalação. Abra o Chrome em `https://192.168.0.20` (use o IP que você anotou). A página abre sem aviso. Menu, **Adicionar à tela inicial** ou **Instalar aplicativo**.

    **iPhone.** Envie `ca.crt` por AirDrop ou e-mail e abra o arquivo. Instale o perfil em Ajustes. Isso ainda não confia na CA para sites. Vá em Ajustes, Geral, Sobre, e no final da tela toque em **Ajustes de Confiança do Certificado** (Certificate Trust Settings). Ative a confiança total de `captura7-ca-local`. Abra o Safari em `https://192.168.0.20`. Compartilhar, **Adicionar à Tela de Início**.

13. O QR de autocadastro usa o mesmo endereço. Quem for se cadastrar pelo QR precisa alcançar esse IP **e** ter a mesma CA instalada, com a confiança total no iPhone. Sem a CA, o celular do visitante continua no aviso do certificado e o cadastro offline não fica garantido. O QR vale duas horas e um cadastro. Para outro cadastro, gere outro QR. Você pode revogar o QR atual.

Se preferir gerar a CA no Windows antes do Docker, com o Git for Windows instalado:

Se o PowerShell disser que a execução de scripts está desabilitada, rode nesta janela, só neste processo: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. O `openssl` precisa estar no PATH. O Git for Windows traz esse programa. Se o comando não for achado, feche e abra o PowerShell depois de instalar o Git, ou inclua a pasta `C:\Program Files\Git\usr\bin`.

```
.\infra\tls\gerar-ca-local.ps1 -Ips 192.168.0.20
```

Os arquivos ficam em `certs-local`. Essa pasta não entra no Git. Para o site usar esses arquivos em vez dos que o container criou:

```
docker compose cp .\certs-local\ca.crt web:/certs/ca.crt
docker compose cp .\certs-local\ca.key web:/certs/ca.key
docker compose cp .\certs-local\captura7.crt web:/certs/captura7.crt
docker compose cp .\certs-local\captura7.key web:/certs/captura7.key
docker compose restart web
```

## Caminho 2 — sem Docker

Este caminho abre o site em HTTP. O navegador do celular funciona. O botão de instalar na tela inicial pode não aparecer, porque o endereço da rede local em HTTP não é tratado como site seguro. Para instalar no celular, use o caminho 1.

1. Instale o [Node.js 22](https://nodejs.org/) e o MongoDB Community, e deixe o MongoDB em execução na porta 27017.
2. No PowerShell, na pasta do projeto, ative o pnpm que já vem com o Node:

   ```
   corepack enable
   corepack prepare pnpm@10.33.3 --activate
   pnpm install
   ```

3. Copie `.env.example` para `.env`. Gere a chave e o pepper e cole no `.env`, no lugar dos textos de exemplo:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Rode duas vezes. A primeira saída é `CIFRA_CHAVE_BASE64`. A segunda é `CIFRA_PEPPER`. Cada uma precisa ter o tamanho de 32 bytes em base64 (a chave) e pelo menos 32 caracteres (o pepper). Não use as palavras `preencha-com`.

4. No mesmo `.env`, defina:

   ```
   NODE_ENV=production
   CONTROLADOR_EMAIL=seu-email@provedor.com
   RETENCAO_MESES=24
   CAPTCHA_PROVEDOR=local
   ERP_WEBHOOK_URL=
   MONGO_URI=mongodb://127.0.0.1:27017/captura7
   ```

5. Compile e suba a API e o site em duas janelas:

   ```
   pnpm build
   pnpm --filter @captura7/api start
   ```

   Esse comando roda `node dist/main.js`. A API lê o `.env` da pasta do projeto (dois níveis acima de `apps/api`) e também um `.env` na pasta atual, se existir. Variável que o Windows já tiver definida não é trocada. Nada do arquivo é impresso no log. No Docker as variáveis vêm do Compose, então esse arquivo não é obrigatório lá.

   Na outra janela:

   ```
   pnpm --filter @captura7/web dev
   ```

6. Crie o administrador, com o MongoDB já no ar:

   ```
   $env:ADMIN_LOGIN="erico"
   $env:ADMIN_SENHA="uma-senha-de-12"
   $env:ADMIN_NOME="Erico Henrique de Lima Araujo"
   pnpm criar-admin
   ```

7. No computador, abra `http://localhost:5173`. No celular, na mesma Wi-Fi, abra `http://IP-DO-PC:5173`. O site encaminha a API para o computador, então o celular não precisa da porta 3000.

## O que fica desligado

- O envio para ERP só liga se você preencher `ERP_WEBHOOK_URL` e `ERP_WEBHOOK_SEGREDO` com valores reais e se a pessoa marcar a caixa opcional de envio. Com a URL vazia, promover um contato não mostra erro.
- O captcha padrão é uma conta de somar, resolvida no seu computador. Para trocar por hCaptcha ou Turnstile, defina `CAPTCHA_PROVEDOR=hcaptcha` ou `CAPTCHA_PROVEDOR=turnstile`, o segredo e a chave pública (`HCAPTCHA_SITEKEY` ou `TURNSTILE_SITEKEY`). A tela passa a mostrar o widget. Sem o segredo, o cadastro público não grava. Sem a chave pública, a tela avisa e não conclui.

## Planilha do Google

No Google Planilhas: Arquivo, Fazer download, Valores separados por vírgula (.csv) ou planilha Excel (.xlsx). No captura7, entre como gestor ou administrador, cole o texto ou escolha o arquivo em **Arquivo CSV ou XLSX** e toque em **Importar planilha**. Linha com o mesmo e-mail, telefone, CPF ou CNPJ é pulada. Linha só com nome igual a um cadastro que também só tem nome é pulada. O mesmo nome em outra empresa entra como novo. Não há fusão automática. A origem fica `importado`.

## Exportar

Entre como administrador, inscreva o autenticador, confirme o código e toque em **Baixar CSV** ou **Baixar XLSX**. Só saem contatos com consentimento de contato comercial válido e ativo. Revogados, eliminados e sem essa autorização ficam de fora. O sistema registra quem exportou e quando.

## Cópia do banco

De vez em quando, copie os dados para fora deste computador. No PowerShell, com o Docker no ar:

```
docker compose exec mongo mongodump --db captura7 --archive=/tmp/captura7.archive.gz --gzip
docker compose cp mongo:/tmp/captura7.archive.gz .\captura7.archive.gz
```

Copie `captura7.archive.gz` para um pen drive ou para outro computador. Se o arquivo ficar só neste PC, ele some junto com a máquina.

Sem Docker, com o `mongodump` instalado:

```
$env:MONGO_URI="mongodb://127.0.0.1:27017/captura7"
sh infra/backup/backup-mongo.sh
```

O prazo de 24 meses, os 30 dias depois da revogação e os 180 dias do rascunho podem ser alterados no `.env` com `RETENCAO_MESES`, `PURGA_REVOGACAO_DIAS` e `RASCUNHO_DIAS`.

## Se algo não abrir

- `https://localhost` avisa do certificado: instale o `ca.crt` desta máquina, como no passo 7. Não instale certificado baixado da internet.
- Celular não abre o IP: confira o Wi-Fi, o IPv4 e o firewall nas portas 80 e 443.
- A API não sobe e fala de pepper: o valor está vazio, curto ou ainda contém `preencha`. Gere outro e, no Docker, não apague o volume se já houver dados.
- Esqueceu a senha do administrador: o comando de criar não troca senha de login existente. Escolha outro `ADMIN_LOGIN` ou apague esse usuário no MongoDB antes de criar de novo.
