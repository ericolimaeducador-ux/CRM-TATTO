# Instalar o captura7 no Windows

Este guia é para usar o captura7 no seu computador. O aplicativo não precisa de empresa, CNPJ nem de internet de nuvem. Os dados ficam nesta máquina.

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

   Troque pelo seu e-mail. Se quiser outro prazo de guarda, acrescente `RETENCAO_MESES=24`. O padrão já é 24 meses sem interação.

5. Suba o sistema:

   ```
   docker compose up --build
   ```

   Na primeira vez a API gera a chave e o pepper sozinha e guarda os dois num volume do Docker. Esses valores não aparecem na tela. Não apague o volume `segredos`: sem ele, os documentos já gravados deixam de abrir.

6. Espere as três partes ficarem saudáveis: banco, API e site. Deixe essa janela aberta.

7. No navegador do computador, abra `https://localhost`. O certificado é criado nesta máquina e o navegador vai avisar que ele não é de uma autoridade conhecida. Isso é esperado. Avance pelo aviso (em português costuma ser "Avançado" e depois "Continuar"). A página do captura7 deve abrir.

8. Crie o administrador. Em outro PowerShell, na mesma pasta:

   ```
   docker compose exec -e ADMIN_LOGIN=erico -e ADMIN_SENHA=uma-senha-de-12 -e ADMIN_NOME="Erico Henrique de Lima Araujo" api node scripts/criar-admin.mjs
   ```

   Troque `erico` e a senha. Se o login já existir, o comando avisa e não troca a senha.

9. No navegador, toque em **Entrar**. Use o usuário e a senha. Depois toque em **Inscrever autenticador**. Copie o segredo para um aplicativo de códigos de 6 dígitos (o autenticador do celular). Digite o código no campo e toque em **Confirmar passo extra**. A exportação só funciona depois desse passo, e o passo vale cinco minutos.

10. Descubra o IP do computador. No PowerShell:

    ```
    ipconfig
    ```

    Procure o adaptador do Wi-Fi e o número **Endereço IPv4**, parecido com `192.168.0.20`.

11. Se o Windows Firewall perguntar, permita o Docker nas redes privadas. Se o celular não abrir a página, em "Firewall do Windows Defender" libere as portas **80** e **443** para redes privadas.

12. No celular, na mesma rede Wi-Fi, abra `https://192.168.0.20` (use o IP que você anotou). Aceite o aviso do certificado uma vez. No Chrome: menu, **Adicionar à tela inicial** ou **Instalar aplicativo**. No Safari: compartilhar, **Adicionar à Tela de Início**. O ícone abre o captura7 como aplicativo.

13. O QR de autocadastro usa o mesmo endereço da página. Abra o captura7 pelo IP (`https://192.168.0.20`), entre, e use **Meu QR**. O celular de quem for se cadastrar precisa alcançar esse IP. O QR vale duas horas e um cadastro. Para outro cadastro, gere outro QR. Você pode revogar o QR atual.

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
- O captcha padrão é uma conta de somar, resolvida no seu computador. Para trocar por hCaptcha ou Turnstile, defina `CAPTCHA_PROVEDOR=hcaptcha` ou `CAPTCHA_PROVEDOR=turnstile` e o segredo correspondente. Sem o segredo, o cadastro público não grava.

## Planilha do Google

No Google Planilhas: Arquivo, Fazer download, Valores separados por vírgula (.csv). No captura7, entre como administrador, cole o texto em **Planilha CSV do Google** e toque em **Importar planilha**. Linha com o mesmo e-mail ou telefone de um cadastro já existente é pulada e não é fundida. A origem fica `importado`.

## Exportar

Entre, inscreva o autenticador, confirme o código e toque em **Baixar CSV** ou **Baixar XLSX**. O sistema registra quem exportou e quando.

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

- `https://localhost` avisa do certificado: avance o aviso. Não instale outro certificado da internet.
- Celular não abre o IP: confira o Wi-Fi, o IPv4 e o firewall nas portas 80 e 443.
- A API não sobe e fala de pepper: o valor está vazio, curto ou ainda contém `preencha`. Gere outro e, no Docker, não apague o volume se já houver dados.
- Esqueceu a senha do administrador: o comando de criar não troca senha de login existente. Escolha outro `ADMIN_LOGIN` ou apague esse usuário no MongoDB antes de criar de novo.
