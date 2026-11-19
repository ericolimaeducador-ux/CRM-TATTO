# Tela Viva — fase de paridade com o modelo do treinamento

## Despacho CC-00 / ORQ-01 — 16/11/2026

O usuário autorizou aproximar localmente o CRM das funções comerciais relevantes do sistema mostrado em `C:\Users\erico\Videos\Gravando 2026-09-23 094751.mp4`. A implantação continua apenas na máquina local; nuvem fica para etapa futura.

### Escopo aprovado

- Várias pessoas de contato relacionadas a cada conta.
- Produtos/preços negociados por cliente, com aprovação e histórico.
- Tarefas com responsável, colaboradores e realização registrada.
- Treinamentos online/presenciais vinculados a contas/oportunidades, com QR de inscrição, participantes e presença.
- Proposta endereçada ao contato escolhido; sem SMTP configurado, apenas rascunho via cliente local e evento de auditoria que não afirma entrega.
- Relatórios comerciais de atividades, oportunidades e treinamentos, após os fluxos principais.

Preservar captura e sincronização offline, dados e usuários existentes, sessão/escopo por carteira e coleção `tela_viva_comercial`. Sem seed nem migração destrutiva. Não importar nem criar prontuário, paciente, cirurgia, estoque, faturamento ou dados regulatórios. Inscrição QR só expõe campos do evento e usa token com digest, validade e limitação local. Nenhum e-mail é enviado automaticamente.

ADR-014 registra as decisões de dados, permissões e integração para a fase. `.graphify/graph.json` não existe; a sequência foi definida por leitura do contrato e revisão do vídeo, sem alegar uso de grafo semântico.

## Estado dos cards

- TV-08 — esquema aditivo de contatos, preços, treinamentos e participantes: concluído; ARQ-02 conferiu tipos/índices; sem migração.
- TV-09 — API e segurança: concluído; pessoas[] validadas/normalizadas, aprovações por gestor/admin e transições auditadas, atribuição e realização de atividades, contato ativo validado em proposta. Build/lint e testes TV-15 passaram. Ressalva original de responsável resolvida pelo TV-17: validação de usuário ativo/papel comercial coberta por 18 cenários novos.
- TV-10 — interface de contatos, preços e tarefas: concluída e QA TV-15 passou. Contato principal legado e múltiplos contatos convivem; preço tem aprovação/histórico; proposta monta mailto sem afirmar envio; tarefa registra atribuição/realização. A lista da interface usa o diretório ativo; a API também valida usuário ativo/papel comercial desde o TV-17.
- TV-10A — diretório mínimo da equipe: concluído; endpoint vendedor/gestor/admin retorna somente ID, nome, papel e ativo, audita leitura; build e ESLint da API passaram.
- TV-11A — índice único de participantes: concluído; índice único parcial por evento/e-mailHash; Prettier passou, sem migração.
- TV-11 — API de treinamentos/participantes e QR: concluída; QR autenticado, consulta/inscrição pública whitelist, 10 tentativas/IP/min, inscrição idempotente por e-mail hash e presença restrita à gestão/auditada. Build/lint passaram. Limite: rate limit em memória, adequado ao local, não a múltiplas instâncias em nuvem.
- TV-11B — reforço de autorização e auditoria, exportação com TOTP: concluído; API bloqueia confirmação de inscrição/presença por vendedor, audita listas com filtros allowlistados; gestor/admin exporta CSV/XLSX com TOTP, auditoria e limite 2.000 linhas. Build/lint passaram.
- TV-12 — interface de treinamentos, participantes, QR e presença: implementação e QA TV-15 concluídos, incluindo QR, inscrição, presença e 360px. Anexos seguem sem contrato.
- TV-12B — botão de exportação TOTP na interface: implementação e QA TV-15 concluídos; modal exige TOTP real, gestor/admin e baixa somente o arquivo da API, sem gerar CSV local.
- TV-13 — registro de preparo de proposta por e-mail: backend concluído; versão de proposta/contato ativo conferidos, auditoria append-only só registra a solicitação com ID de contato, não armazena e-mail/corpo nem chama SMTP. API build/lint passaram.
- TV-13A — UI de rascunho: implementação e QA TV-15 concluídos; ação auditada precede `mailto`, recebe a versão atualizada do servidor e não declara envio. SMTP segue não configurado.
- TV-14 — endpoint agregado de relatórios por período/carteira: concluído; API build/lint passaram. Retorna contagens/valores, sem PII.
- TV-14A — interface `/relatorios`: implementada e QA TV-15 passou; período padrão 30 dias, máximo 366, filtro de equipe para gestão, estados carregando/erro/vazio, dados agregados sem PII e E2E em 360px.
- TV-15 — concluído após TV-18: API completa 162/37, focal de fronteira 3/3, E2E 10/10, lint completo e build produção final aprovados. Web 39/17 é baseline sem alteração funcional neste ciclo.
- TV-16 — REV-11 concluído após TV-18: APROVADO COM RESSALVAS para uso local; Docker final construído e ativo, saúde dos serviços e preservação do Mongo confirmadas pelo CC-00.

## Evidências e limitações

MongoMemoryServer foi usado somente em teste e os defeitos foram reproduzidos sem tocar no banco do CRM. Após o rebuild Docker final, CC-00 reportou API/Mongo saudáveis e web ativo com redirecionamento HTTP→HTTPS (301). O volume persistente foi mantido; a base `captura7` permaneceu com 1 usuário e 0 documentos comerciais. Não executar remoção de volumes.

## QA-09 — TV-15 concluído em 16/11/2026

| Verificação executada | Resultado |
|---|---|
| `corepack pnpm --filter @captura7/api exec jest --runInBand` | 35 suítes, 141 testes aprovados |
| Suíte web via `corepack pnpm -r --if-present test` | 17 arquivos, 39 testes aprovados |
| `corepack pnpm -r --if-present lint` | API e web aprovados |
| `corepack pnpm test:e2e` | 10 cenários aprovados em 22,1 s; API temporária 3101 e preview 4173 |
| `corepack pnpm -r --if-present build` após o E2E | API e web de produção aprovados; PWA com 36 entradas de precache |
| Bundle final de produção | Nenhuma ocorrência de porta 3101, `x-papel-teste` ou flag `VITE_CAPTURA7_HEADERS_TESTE` nos JS gerados |

### Cobertura acrescentada nesta etapa

- `apps/api/src/comercial/paridade.spec.ts`: inscrição staff/QR sem duplicata; auditor sem acesso nominal a participantes; PATCH com datas consistentes; preço solicitado/aprovado/encerrado com motivo, permissões e trilha; realização de tarefa com autor/relógio do servidor; preparo auditado de proposta e bloqueio de contato inativo; consulta pública whitelist, presença protegida e CSV com step-up/auditoria.
- `apps/api/src/comercial/paridade-autorizacao.spec.ts`: defesa do serviço contra leitura de PII de participantes pelo auditor, sem depender do Mongo.
- `apps/web/src/features/comercial/PaginaRelatorios.test.tsx`: cinco testes de filtros de datas/carteira, diretório da gestão, validação de período, erro/repetição/vazio e falta de sessão. A tela não exporta listas pessoais.
- `e2e/paridade.spec.ts`: QR de treinamento, inscrição pública, registro de presença pela gestão e relatório agregado real em 360 px; ausência de rolagem horizontal e de e-mail pessoal na tela de relatórios.
- A bateria E2E completa preservou captura em avião, reabertura de aba durante autosave, fila presa, navegação de dois toques, promoção, fusão, consentimento e proposta comercial/impresso.

### Falhas encontradas e repetição

QA inicialmente reproduziu três defeitos de produção (duplicata staff/QR, PII exposta ao auditor e data final inconsistente em PATCH). API-03 corrigiu os caminhos de normalização/HMAC, autorização e validação do estado resultante. Os cinco testes iniciais e a bateria ampliada agora passaram.

Uma execução concorrente API+web terminou com código nativo Windows/Node 24 `3221226505`, sem falha de asserção. A API foi repetida sozinha e concluiu com 141/141; esse resultado confirmado é o usado acima. A tentativa inicial dentro do sandbox havia sido bloqueada por `spawn EPERM`; a execução autorizada usou MongoDB temporário.

### Limites e encaminhamento

Nenhum contêiner, volume, usuário ou registro da base real foi alterado pela QA. O build de teste foi substituído pelo build de produção ao fim. Câmera física, cliente externo de e-mail/entrega SMTP, provedores externos e operação em múltiplas instâncias não foram exercitados; QR e navegador foram testados em ambiente temporário local. Rate limit de inscrição permanece em memória, conforme escopo local. Não houve push nem commit.

### REV-11 — primeiro parecer TV-16, 16/11/2026 (histórico; ressalva de equipe resolvida em TV-17)

**Parecer: APROVADO COM RESSALVAS para continuidade local.** Os contratos aditivos preservam a coleção/dados antigos; relatórios são agregados; auditor não acessa participantes; inscrição QR não devolve PII; exportação exige gestor/admin e step-up; captura offline permanece coberta pela regressão. QA: API 141/141, web 39/39, E2E 10/10, lint e build produção passaram.

**Ressalvas daquele parecer.** A validação de atribuições por formato de ID foi resolvida no ciclo TV-17 abaixo. Permanecem as demais limitações: Docker local ainda exige rebuild; rate limit do QR é em memória; câmera física, SMTP real, entrega externa e operação em nuvem não foram testados nem configurados.

Não executar `docker compose down -v`; o Mongo real tinha 1 usuário e 0 documentos comerciais antes do rebuild. Recontar após rebuild. Esta aprovação refere-se à implementação/QA em ambiente de teste e à continuidade local após rebuild, não a prontidão para nuvem ou garantia de integração externa. O push GitHub ainda depende do fluxo de entrega conduzido pelo CC-00.

### QA-09 — reabertura focal após TV-17

API-03 corrigiu a ressalva P2 do primeiro portão: o servidor consulta a coleção de usuários e valida existência, estado ativo e papel comercial nas atribuições de atividades. QA acrescentou `apps/api/src/comercial/paridade-usuarios.spec.ts` com 18 cenários: POST e PATCH; responsável e colaboradores; rejeição de ID inexistente, usuário inativo e auditor; aceitação de vendedor/gestor/admin ativos; deduplicação e preservação de documento, versão e trilha após rejeição. A fixture ANA do teste de realização passou a ser um usuário ativo real no MongoDB temporário, sem enfraquecer as asserções.

**Resultado confirmado:** `corepack pnpm --filter @captura7/api exec jest --runInBand --runTestsByPath src/comercial/paridade-usuarios.spec.ts src/comercial/paridade.spec.ts src/comercial/paridade-autorizacao.spec.ts` aprovou **27 testes em 3 suítes**, em 30,1 s. ESLint dos testes passou; API-03/CC-00 confirmou build e lint da API aprovados para a correção.

**Limite da repetição geral:** uma chamada posterior para a suíte API completa foi interrompida sem retornar saída, código de saída ou identificador de sessão. Não é correto classificá-la como aprovada nem como falha de asserção. Uma tentativa de consultar comandos de processos via CIM foi bloqueada por acesso negado; nenhum processo antigo foi encerrado sem identificação. A bateria E2E completa não foi repetida neste ciclo. Por orientação do CC-00, a evidência de encerramento usa o focal confirmado, build/lint da API e o baseline anterior **API 141/web 39/E2E 10**. Não se alega execução única de 159 testes.

Nenhuma alteração em Docker ou base real foi feita pela QA; a implementação TV-17 alterou a API e a QA acrescentou testes/fixtures e registros de estado.

### REV-11 — reabertura TV-16 após TV-17, 16/11/2026

**Parecer: APROVADO COM RESSALVAS para continuidade local.** Revisei o novo guard, o schema/permissões, os 18 testes HTTP, o board e este progresso. `validarEquipeAtiva` consulta usuários ativos com papéis `vendedor`, `gestor` ou `admin`, antes de POST e PATCH, e rejeita atribuições inválidas sem gravar versão/auditoria; 27 cenários focais passam. Não encontrei regressão óbvia no escopo da carteira nem acesso a dados pessoais decorrente da mudança.

**Cobertura deste ciclo:** 27/27 testes focais em três suítes; build e lint da API aprovados. A tentativa da suíte API completa foi interrompida sem sessão/saída/código de conclusão, portanto o resultado não é conhecido. O E2E não foi repetido após TV-17. Os números API 141, web 39 e E2E 10 são do baseline anterior à alteração, não uma validação completa da revisão atual.

O gate aprova a correção pontual e a continuidade local com essa ressalva explícita de cobertura. Permanecem pendentes o rebuild/verificação dos containers locais e os limites de nuvem, SMTP, câmera física e rate limit em memória. Não alegar que as suítes completas e E2E foram executadas após TV-17.

### QA-09 — TV-18 aberto após E2E, 16/11/2026

Depois do parecer TV-17, a suíte API completa foi executada fora do sandbox com MongoMemoryServer: **36 suítes, 159 testes aprovados**. Build/lint API já haviam passado. E2E completo pós-TV-17 teve **9/10 cenários**: os nove demais passaram, mas o treinamento/relatório mostrou 0 presenças em vez de 1 para uma inscrição marcada presente às **21h33 BRT (00h33Z)**.

A UI calcula o período pelo calendário local (`PaginaRelatorios.tsx`); a API converte `YYYY-MM-DD` para limites UTC à meia-noite e filtra `criadoEm`, deixando de fora registros do mesmo dia local após 21h BRT. Essa é uma falha real de janela, não diferença de fixture. TV-18 foi aberto para usar os limites do fuso `America/Sao_Paulo`, cobrir a fronteira em API e repetir E2E. **Não publicar no GitHub até TV-18, QA e novo portão REV-11 passarem.**

O rebuild Docker feito antes da TV-17 continua desatualizado para as alterações mais recentes e precisará ser repetido após a correção. O volume Mongo real foi preservado durante aquele rebuild e as contagens permaneceram em 1 usuário e 0 documentos comerciais.



### QA-09 — diagnóstico confirmado TV-18: janela local versus UTC

O E2E pós-TV-17 passou 9/10; o cenário de treinamento marcou presença, mas o relatório mostrou zero. A repetição isolada (`corepack pnpm exec playwright test -c e2e/playwright.config.ts e2e/paridade.spec.ts`) reproduziu a falha. O teste ganhou somente instrumentação de diagnóstico, preservando a asserção original de presença igual a 1. Nenhum módulo de produção foi alterado pela QA.

Evidência HTTP do ambiente temporário:

| Dado observado | Valor |
|---|---|
| Browser | 16/11/2026 21:36:46, `America/Sao_Paulo` |
| Mesmo instante UTC | `2026-11-17T00:36:46.232Z` |
| Consulta inicial | `de=2026-10-18&ate=2026-11-16`, HTTP 200 |
| Participantes na resposta inicial | inscrições 0, confirmados 0, presentes 0 |
| Registro realmente gravado | `criadoEm=2026-11-17T00:36:45.199Z`, `status=presente`, `confirmado=true`, `presente=true` |
| Mesmo escopo, mudando apenas `ate=2026-11-17` | inscrições 1, confirmados 1, presentes 1 |

A causa não é falha de gravação de presença nem filtro por usuário/carteira: a UI cria datas de calendário locais (`PaginaRelatorios.tsx`, `dataLocal/periodoInicial`), mas `dataDeRelatorio` da API interpreta essas datas como meia-noite UTC e usa esses limites em `criadoEm`. Após 21h BRT, registros do dia local já têm o dia UTC seguinte e ficam fora da seleção local.

Artefato sem PII: `test-results/paridade-treinamento-receb-34690-alimenta-relatório-agregado/diagnostico-relatorio-fuso.json`. Asserção original mantida: o focal terminou com 1 cenário reprovado (esperado 1, recebido 0). TV-15/TV-16 reabertos e TV-18 encaminhado ao API-03 para alinhar a janela `America/Sao_Paulo` e cobrir o limite de 23:30 BRT/00Z. O bundle local ainda é o gerado para E2E; deverá ser reconstruído em produção após a correção e a validação final.

### QA-09 — fechamento funcional TV-18, 18/11/2026

O CC-00 confirmou as execuções finais fora do sandbox: **API completa pós-TV-18 162/162 testes em 37 suítes**, **focal de relatórios 3/3** e **E2E pós-TV-18 10/10**. Esses resultados substituem a incerteza da tentativa anterior e a falha 9/10 do ciclo de diagnóstico, preservadas acima como histórico.

`apps/api/src/comercial/paridade-relatorios.spec.ts` cobre registros criados às 23:30 de São Paulo (02:30Z do dia seguinte UTC), o limite exclusivo da meia-noite seguinte (03:00Z), a data marcada da atividade independentemente da criação, valores de oportunidades/propostas e contagem de treinamentos. Verifica também o escopo por carteira e a preservação das datas de calendário na resposta.

**Checagens executadas pela QA neste fechamento:**

| Comando | Resultado |
|---|---|
| `node node_modules/eslint/bin/eslint.js apps/api/src apps/api/test apps/api/migrations apps/web/src --max-warnings 0` | aprovado, exit 0 |
| `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit` | aprovado, exit 0 |
| Suíte web | baseline anterior confirmado de 39/39 em 17 arquivos; não repetida neste fechamento |
| Build final de produção | será registrado pelo CC-00 após o ajuste textual da descrição do fuso; não inferido do build de E2E |

A indicação residual de UTC na descrição da tela foi reportada pela QA e corrigida pelo CC-00 para America/Sao_Paulo. A QA não alterou módulos de produção nem executou Docker/Git; a execução direta das suítes que exigem subprocessos foi confirmada pelo CC-00, pois chamadas escaladas do agente auxiliar não iniciaram de forma confiável. Não há processo de teste próprio pendente nem resultado pendente de coleta da QA.

**TV-15 e TV-18 encerrados; TV-16 aprovado pelo portão.** O build de produção e o rebuild local foram concluídos. A aprovação limita-se ao ambiente local e às evidências listadas; não cobre SMTP real, câmera física, rate limit multi-instância ou nuvem.

### REV-11 — parecer final pós-TV-18, 18/11/2026

**Parecer: APROVADO COM RESSALVAS para uso local.** A implementação revisada inclui a correção de janela por calendário de São Paulo, guard de atribuição de usuários ativos/papéis comerciais e texto alinhado na tela. ADR-015 define dias civis inclusivos em `America/Sao_Paulo`. A fronteira 23:30/00:00 tem teste dedicado; o escopo de carteira e os agregados sem PII permanecem preservados.

**Evidências do fechamento:** API 162/162 em 37 suítes; testes focais de fuso 3/3; E2E 10/10; lint completo e build de produção final aprovados. A suíte web 39/39 é baseline anterior e não foi repetida neste fechamento; a tela só teve ajuste textual. Docker foi reconstruído e iniciado; API e Mongo saudáveis, web ativo respondendo HTTP→HTTPS 301. O volume Mongo persistiu e a contagem permaneceu em 1 usuário e 0 documentos comerciais.

**Limites:** rate limit do QR permanece em memória e é local/single-instance; SMTP/entrega, câmera física e ambiente de nuvem não foram testados. Esta aprovação não certifica produção em nuvem nem integrações externas. A suíte web não executada novamente é uma limitação de cobertura documentada, sem regressão conhecida pelo ajuste textual.

### Correção da conferência de banco — 18/11/2026

Na etapa seguinte de WhatsApp, a leitura da conexão efetiva da API mostrou que a URI preexistente aponta para MongoDB Atlas, banco `captura7` (2 usuários, 5 contatos, 0 registros comerciais). As contagens de 1 usuário/0 documentos citadas anteriormente referiam-se ao Mongo do Compose, não ao banco efetivamente usado pela API. API e frontend rodam localmente; a conexão existente foi preservada, sem migração ou alteração de URI. Nenhuma credencial é registrada neste documento. Veja `PROGRESS_FASE_WHATSAPP.md` para a evidência e o estado desativado da automação.
