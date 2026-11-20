# Tela Viva

CRM da Tela Viva, marca operada pela JSETTE7 e representante Pele Rara® para o segmento de tatuagem. Usa um fluxo de carteiras e visitas inspirado em representantes da indústria farmacêutica e de produtos médicos. Organiza carteira, visitas, oportunidades, produtos representados e propostas, preservando a captura rápida de leads por QR ou digitação.

## Fluxo de trabalho

1. Entre com seu usuário e senha. O login não pede código de autenticador.
2. Cadastre as instituições da carteira: hospitais, clínicas, farmácias, consultórios ou distribuidores.
3. Planeje visitas e tarefas na agenda, registre o resultado e defina a próxima ação.
4. Acompanhe oportunidades no funil e prepare propostas com os produtos representados.
5. Use a captura para guardar um novo contato mesmo sem internet. A fila informa quando ele chega ao servidor.

Os módulos comerciais usam a API e exigem conexão; a captura original mantém fila offline. A instalação começa sem exemplos fictícios. Representantes acessam sua própria carteira; gestão e auditoria seguem os perfis do sistema. Produtos e propostas são registros comerciais internos: não há envio automático ao cliente nem integração regulatória implícita.

Administradores criam os acessos da equipe em **Usuários**. Senha, sessão, planilhas e confirmação de operações sensíveis ficam em **Minha conta**. Veja o [guia de acesso e equipe](docs/ACESSO.md).

O banco, os nomes dos pacotes `@captura7/*`, as variáveis de ambiente e as chaves de armazenamento existentes continuam com seus identificadores para preservar dados e instalação. O nome exibido do produto é **Tela Viva**.

## Desenvolvimento e validação

Node >=22 e pnpm 10.33.3. Instale com `corepack pnpm install --frozen-lockfile`. Com Mongo e segredos configurados conforme o guia Windows, execute a API e o web em terminais separados:

```powershell
corepack pnpm --filter @captura7/api build
corepack pnpm --filter @captura7/api start
```

```powershell
corepack pnpm --filter @captura7/web dev
```

Checks portáveis quando não existe `pnpm` diretamente no PATH:

```powershell
corepack pnpm -r --if-present lint
corepack pnpm -r --if-present build
corepack pnpm -r --if-present test
```

Veja [docs/TELA-VIVA.md](docs/TELA-VIVA.md) para os módulos e contratos e [PROGRESS_FASE_PARIDADE.md](PROGRESS_FASE_PARIDADE.md) para a validação da fase de paridade: contatos múltiplos, preços negociados, equipe, treinamentos/QR, presença e relatórios.

Uso interno da JSETTE7, com API e frontend executados no computador da operação. A conexão de banco é definida por `MONGO_URI`; na instalação conferida em 18/11/2026, ela já aponta para MongoDB Atlas. O Mongo do Compose também existe, mas não é o destino dessa conexão. O passo a passo no Windows está em [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md).

## Automação de WhatsApp

O módulo de boas-vindas usa a Cloud API oficial da Meta, fila persistente no Mongo e processamento em segundo plano. O envio nasce **desativado** (`WHATSAPP_ENVIO_ATIVO=false`). A preparação e os requisitos de ativação estão em [docs/WHATSAPP.md](docs/WHATSAPP.md). Novos leads precisam de telefone válido e autorização de contato registrada; a captura continua permissiva.

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

O workflow `.github/workflows/pages.yml` só publica mediante acionamento manual. Enviar código ao GitHub não publica o CRM. A instalação atual funciona localmente; API e MongoDB continuam no computador da operação.

Se houver implantação futura em Pages, o workflow calcula `PAGES_BASE` pelo nome do repositório. A variável `VITE_API_URL` entra no JavaScript e deve apontar para uma API acessível, com `CORS_ORIGENS` configurado para a origem do site. Pages hospeda apenas arquivos estáticos.

O Compose local continua com `VITE_API_URL` vazio, então neste computador o site chama `/v1` no mesmo endereço. O termo continua descrevendo o computador local. O Pages entrega o aplicativo; não guarda a base de contatos.
