# PROGRESS — Fase 0 · Fundação

## Confirmação de absorção — 2026-09-25

(a) Entrada permissiva, saída controlada: a captura não tem campo obrigatório; o controle mora na promoção, nunca na coleta.
(b) Quatro modos: `qr_lido`, `qr_proprio`, `manual`, `google_forms`.
(c) Quatro papéis: `vendedor` (só a própria carteira), `gestor` (base inteira e promoção), `admin` (configuração), `auditor` (somente leitura, inclusive a trilha).
(d) Bloqueio só na transição de status e nas ações de saída (merge, exportação, step-up). Gravar rascunho nunca é impedido. O texto do termo trava F2-04 e F3-02, não a Fase 0.
(e) Dilema com a regra 010: não implemento, registro em `.grok/ESCALONAMENTOS.md` no formato da seção 13.2 e sigo no que não depende disso.

**Objetivo.** Modelo de dados definitivo, trilha de auditoria funcionando e repositório
de pé. Nada de tela, nada de câmera.

**Regra de saída da fase.** Nenhum card da Fase 1 abre antes do veredito do REV-11 neste arquivo.

## Cards

| Card | Agente | Status | Observação |
|---|---|---|---|
| F0-01 Bootstrap | OPS-10 | feito no portão, com ressalva | build e lint verdes; Compose não fechou em máquina limpa neste host |
| F0-02 Schemas + índices | ARQ-02 | feito no portão | 5 critérios verdes em MongoDB 7; índice parcial em ADR-007 |
| F0-03 Revisão LGPD | SEC-07 | feito no portão | ADR-004 aceito; guard e cifra verdes |
| F0-04 Completude e normalização | DQ-08 | feito no portão | tabela de 12 combinações verde |
| F0-05 Plano de testes | QA-09 | feito no portão, com ressalva | suíte verde neste host; CI do GitHub não executado daqui |
| F0-06 Portão | REV-11 | feito | APROVADO COM RESSALVAS |

## Parecer OPS-10 — F0-01

Ambiente/pipeline tocado: monorepo pnpm (`apps/api` NestJS 10, `apps/web` React 18 + Vite), Docker Compose, GitHub Actions, ESLint, Prettier, husky, lint-staged, `.env.example`
`docker compose up` do zero funciona: não
TLS configurado: não se aplica
Backup: frequência não definida · criptografado não · destino externo não definido · regra 3-2-1 não
Restauração testada: não — RTO não declarado · RPO não declarado
Segredo fora do repositório: sim
Alertas ativos: nenhum em produção. `GET /v1/saude` expõe `filaSincronizacao` e o gancho avisa se a profundidade subir; a fila real é da Fase 1
Ação necessária antes de seguir: o comando único construiu as imagens e o mongo ficou healthy. A API não abriu TCP com o mongo porque o iptables-legacy deste host (FORWARD em DROP) descartava o bridge do Compose, enquanto o daemon tinha escrito a regra no nftables. Uma regra ACCEPT só nesta máquina fez os três subirem: `/v1/saude` respondeu `status ok` e o web entregou o HTML em `127.0.0.1:5173`. Essa regra não entra no repositório. Backup continua sendo o F3-04. A proteção de branch no GitHub (check obrigatório) não foi aplicada daqui.

## Parecer ARQ-02 — F0-02

Entidades tocadas: `contatos`, `contatos_auditoria`, `contadores`
Campos adicionados/alterados: schema de contato da seção 4.1, com `tipoPessoa` default `INDEFINIDO`, `status` default `rascunho`, bloco `lgpd` preenchido por default e sem campo de CPF/CNPJ em texto puro
Índices criados (e por que cada um existe): os doze da seção 4.4. Unicidade de `pf.cpfHash` e `pj.cnpjHash` só fora de rascunho e descarte; `idLocal` e `codigo` únicos para idempotência e sequência; os demais são busca
Risco de perda de histórico identificado: nenhum. Alteração de não-rascunho grava uma linha por campo em `contatos_auditoria`; update e delete nessa coleção lançam erro; `deleteOne` em contato também
Compatibilidade com ADR-001 (índice parcial) verificada: sim
Migração reversível: sim — arquivo: `apps/api/migrations/20260925-indices-contatos.ts` (up duas vezes e down executados)
Ação necessária antes de seguir: a expressão literal `$nin` da seção 4.4 não cria índice no MongoDB 7.0.24. ADR-007 troca por `$in` dos status que restam no enum. A suíte que provou os 5 critérios fica no glob do QA-09 e entra no commit do F0-05.

## Parecer SEC-07 — F0-03

Dado/ação envolvida: CPF/CNPJ em repouso, matriz de papéis, base legal automática, predicados de revogação e retenção
Sensibilidade: alta
Papéis com acesso e justificativa (menor privilégio): `vendedor` só na própria carteira; `gestor` na base e na promoção; `admin` na configuração; `auditor` somente leitura, inclusive trilha. Fonte única: `PERFIL_PERMISSOES`
Criptografia em repouso aplicada: sim — algoritmo: AES-256-GCM no valor e HMAC-SHA256 no hash indexado. Chave e pepper só por ambiente
Base legal registrada e não vazia: sim
Log de acesso gerado: não se aplica — não há listagem nem exportação nesta fase. O predicado `exportacaoBloqueada` já impede a saída quando `revogadoEm` existe
Step-up exigido: sim — em promoção a cliente, fusão, exportação e alteração de papel. A captura não pede. O TOTP em si chega na Fase 3; o guard já recusa sem a confirmação do servidor
Nova superfície de ataque introduzida: nenhuma. O teste injeta papel por middleware local; a API não lê papel de header
Veto exercido: não

## Parecer DQ-08 — F0-04

Regras de normalização aplicadas: telefone para E.164 assumindo +55 sem DDI; e-mail válido em minúsculas e trim; CPF/CNPJ só dígitos quando o DV confere; nome em Title Case preservando de, da, do, das, dos e e; CEP com 8 dígitos
Valores não normalizáveis: grava como veio + aviso (`TELEFONE_INVALIDO`, `EMAIL_INVALIDO`, `CPF_INVALIDO`, `CNPJ_INVALIDO`, `CEP_INVALIDO`). Nenhum caminho lança para rejeitar a captura
Pesos do score de completude: `PESOS_COMPLETUDE` em `apps/api/src/qualidade/completude.ts` — nome 20, documento válido 20, telefone 15, e-mail 10, endereço completo 15, tipo de pessoa definido 10, campos específicos 10. Endereço completo = logradouro + número + cidade + UF
Camadas de dedup ativas e seus limiares: nenhuma nesta fase. Dedup e merge são o F2-03
Falso positivo mais provável identificado: matriz e filial, ainda sem detector. Mitigação: não há fusão nem marca de duplicata neste card
Merge automático em algum caminho: não
Precedência de valor respeitada: sim — esta fase só normaliza o que chegou; não há enriquecimento escrevendo por cima
Ação necessária antes de seguir: a transição `rascunho → capturado` quando score ≥ 25 está na função pura. Quem persiste isso é a API da Fase 1

## Parecer QA-09 — F0-05

Categorias aplicadas: 1 funcional (persistir Ana, migração, tabela de score); 2 captura sem trava (um campo, CPF malformado, dois rascunhos com o mesmo CPF); 3 integridade (auditoria com valor anterior e novo, deleteOne recusado, update de auditoria recusado); 6 acesso (rota sem @Papel negada, auditor sem escrita, vendedor fora da carteira, exportação sem step-up). Exclusões: 4 offline — não há fila nem service worker de captura nesta fase (F1-02); 5 concorrência parcial — duas promoções simultâneas com o mesmo hash estão cobertas, dois usuários editando o mesmo contato e duplo POST HTTP ficam para a API da Fase 1; 7 dedup e merge — o card é F2-03 e não há fusão para testar
Testes escritos: `apps/api/test/f0-criterios.spec.ts`, `f0-migracao.spec.ts`, `f0-acesso.spec.ts`, `apps/web/src/App.test.tsx`, mais os specs de SEC-07 e DQ-08 que a suíte também executa. 49 testes de API e 1 de web, verdes neste host contra MongoDB 7.0.24 via mongodb-memory-server
Falhas encontradas: nenhuma na suíte. O `docker compose up` em máquina limpa deste host não passou sem regra de firewall local; isso não é teste automatizado e está no parecer do OPS-10
Falha silenciosa identificada (a mais perigosa): sim — o healthcheck do mongo passa dentro do container mesmo quando a API não completa TCP. A suíte não cobre essa rede. O log da API é explícito (`Server selection timed out`), não é sucesso falso de persistência
Cenários críticos cobertos nominalmente: `{ nome: "Ana" }` persiste; dois rascunhos com o mesmo CPF coexistem; qualificado duplicado devolve `CPF_DUPLICADO`; alteração de não-rascunho gera auditoria; `tipoPessoa` `INDEFINIDO` persiste; CPF malformado não bloqueia; `criadoPor` do cliente é descartado; rota sem papel é negada; tabela de 12 scores
Pronto para o portão REV-11: sim

## Veredito do Portão

### Parecer Dev 1 — Correção funcional
- Aprovado com ressalvas
- Achados: `{ nome: "Ana" }` persiste; dois rascunhos com o mesmo CPF coexistem; promoção duplicada devolve `CPF_DUPLICADO` com mensagem em português, sem vazar E11000; CPF malformado grava e não bloqueia; a tabela de 12 scores é determinística e soma 100; valor que não normaliza volta com aviso e o bruto original. A função de completude devolve `capturado` quando o score passa de 25 e o status ainda é rascunho, mas ninguém persiste essa transição nesta fase.
- Ação necessária antes de produção: a API da Fase 1 precisa gravar a transição sugerida; o `docker compose up` em máquina limpa deste host não ficou verde (ver parecer OPS-10); o workflow de CI não foi executado no GitHub.

### Parecer Dev 2 — Integridade de dado e auditoria
- Aprovado com ressalvas
- Achados: alteração de contato que já não é rascunho gera uma linha por campo em `contatos_auditoria`, com valor anterior e novo; update e delete nessa coleção lançam erro; `deleteOne` em contato lança `ExclusaoFisicaProibida`; edição de rascunho não escreve trilha, como a seção 4.3 pede. Os doze índices da seção 4.4 existem. A unicidade de CPF/CNPJ é parcial. O filtro literal `$nin` não sobe no MongoDB 7.0.24; o ADR-007 grava o complemento fechado com `$in`. Autoria vinda do cliente é descartada e logada como `tentativa_autoria_cliente`.
- Ação necessária antes de produção: a trilha desta fase é plugin do Mongoose, não o interceptor HTTP da Fase 1. Rascunho pode nascer com `criadoPor` vazio enquanto não há sessão. Quem gravar contato pela API tem que injetar `autorId` no servidor antes de sair de rascunho.

### Parecer Dev 3 — Segurança e escala
- Aprovado com ressalvas
- Achados: CPF/CNPJ entram só por `$locals` e saem cifrados (AES-256-GCM) com hash HMAC-SHA256; o schema não tem campo em texto puro. Chave e pepper não estão no repositório. Rota sem `@Papel` responde 403 `PAPEL_INSUFICIENTE`. Exportação sem step-up do servidor responde `STEP_UP_NECESSARIO`. A API de produção não lê papel de header. A varredura de segredos passou neste host. Não há teste de volume: a coleção de desenvolvimento está vazia e `background: true` nos índices não foi medido com carga.
- Ação necessária antes de produção: o step-up desta fase é um flag do servidor, não TOTP (F3-01). Backup 3-2-1 continua no F3-04, sem RTO/RPO. O termo de consentimento segue aberto e trava F2-04 e F3-02, não esta fase. A proteção de branch no GitHub não foi aplicada daqui.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? sim — linha por campo em alteração de não-rascunho; a coleção de auditoria recusa update e delete.
2. Captura sem campo obrigatório? sim — um nome persiste, CPF inválido persiste, rascunho não é impedido.
3. Responsável identificado em toda ação? sim — não-rascunho sem autor é recusado; autoria do cliente é descartada; não há usuário fictício. Rascunho pode ficar sem `criadoPor` até existir sessão HTTP.
4. Estado de sincronização honesto? sim — o placeholder web não diz "Salvo" e não há fila local apresentada como persistida.
5. Carga cognitiva reduzida? sim — não há tela de captura nesta fase; o placeholder não pede campo.
6. Quebra fluxo existente? não — não havia fluxo de captura, dedup ou auditoria antes desta fundação.

VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado nas seis respostas; nenhuma reprovação automática]
Pendências antes de produção:
- `docker compose up` do zero não passou neste host sem regra ACCEPT no iptables-legacy do bridge, fora do repositório.
- GitHub Actions configurado e não executado daqui. Proteção de branch não aplicada.
- Transição de score, interceptor HTTP de auditoria, TOTP real, fila offline e backup 3-2-1 ficam nas fases seguintes.
- Termo de consentimento continua aberto em `.grok/ESCALONAMENTOS.md`.
Observação: este portão prepara o material de revisão e não substitui revisão humana quando exigida pelo processo da empresa.

## RELATÓRIO — FASE 0 — 2026-09-25

### Executado
| Card | Agente | Status | Arquivos |
|---|---|---|---|
| Banco de agentes | — | instalado sem alterar conteúdo | 22 arquivos na raiz: `.grok/SUPERCOMANDO.md`, `AGENTS.md`, `INSTALAR.md`, `PROGRESS_FASE_0.md`, `.cursor/rules/000-projeto.mdc`, `.cursor/rules/010-integridade.mdc`, `.grok/BOARD.md`, `.grok/DECISOES.md`, `.grok/ESCALONAMENTOS.md`, `.grok/config.md` e as 12 personas em `.grok/agents/` |
| Configuração inicial | ORQ-01 | feito | `.grok/config.md`, `.grok/DECISOES.md` (ADR-005, ADR-006), `PROGRESS_FASE_0.md` |
| F0-01 Bootstrap | OPS-10 | feito no portão, com ressalva | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.env.example`, `apps/api` e `apps/web` (esqueleto), `infra/**`, `.husky/pre-commit` |
| F0-02 Schemas + índices | ARQ-02 | feito no portão | `apps/api/src/contatos/schemas/**`, `apps/api/migrations/20260925-indices-contatos.ts`, `apps/api/migrations/cli.ts`, ADR-007 |
| F0-03 Revisão LGPD | SEC-07 | feito no portão | `apps/api/src/seguranca/**`, `apps/api/src/auth/**`, `apps/api/src/lgpd/**`, `docs/lgpd/**`; ADR-004 marcado aceito |
| F0-04 Completude e normalização | DQ-08 | feito no portão | `apps/api/src/normalizacao/**`, `apps/api/src/qualidade/**` |
| F0-05 Plano de testes | QA-09 | feito no portão, com ressalva | `apps/api/test/f0-criterios.spec.ts`, `f0-migracao.spec.ts`, `f0-acesso.spec.ts`, `apps/web/src/App.test.tsx`, `e2e/README.md` |
| F0-06 Portão | REV-11 | feito | `PROGRESS_FASE_0.md`; o board foi movido pelo CC-00 |

### Pareceres dos agentes

## Parecer OPS-10 — F0-01

Ambiente/pipeline tocado: monorepo pnpm (`apps/api` NestJS 10, `apps/web` React 18 + Vite), Docker Compose, GitHub Actions, ESLint, Prettier, husky, lint-staged, `.env.example`
`docker compose up` do zero funciona: não
TLS configurado: não se aplica
Backup: frequência não definida · criptografado não · destino externo não definido · regra 3-2-1 não
Restauração testada: não — RTO não declarado · RPO não declarado
Segredo fora do repositório: sim
Alertas ativos: nenhum em produção. `GET /v1/saude` expõe `filaSincronizacao` e o gancho avisa se a profundidade subir; a fila real é da Fase 1
Ação necessária antes de seguir: o comando único construiu as imagens e o mongo ficou healthy. A API não abriu TCP com o mongo porque o iptables-legacy deste host (FORWARD em DROP) descartava o bridge do Compose, enquanto o daemon tinha escrito a regra no nftables. Uma regra ACCEPT só nesta máquina fez os três subirem: `/v1/saude` respondeu `status ok` e o web entregou o HTML em `127.0.0.1:5173`. Essa regra não entra no repositório. Backup continua sendo o F3-04. A proteção de branch no GitHub (check obrigatório) não foi aplicada daqui.

## Parecer ARQ-02 — F0-02

Entidades tocadas: `contatos`, `contatos_auditoria`, `contadores`
Campos adicionados/alterados: schema de contato da seção 4.1, com `tipoPessoa` default `INDEFINIDO`, `status` default `rascunho`, bloco `lgpd` preenchido por default e sem campo de CPF/CNPJ em texto puro
Índices criados (e por que cada um existe): os doze da seção 4.4. Unicidade de `pf.cpfHash` e `pj.cnpjHash` só fora de rascunho e descarte; `idLocal` e `codigo` únicos para idempotência e sequência; os demais são busca
Risco de perda de histórico identificado: nenhum. Alteração de não-rascunho grava uma linha por campo em `contatos_auditoria`; update e delete nessa coleção lançam erro; `deleteOne` em contato também
Compatibilidade com ADR-001 (índice parcial) verificada: sim
Migração reversível: sim — arquivo: `apps/api/migrations/20260925-indices-contatos.ts` (up duas vezes e down executados)
Ação necessária antes de seguir: a expressão literal `$nin` da seção 4.4 não cria índice no MongoDB 7.0.24. ADR-007 troca por `$in` dos status que restam no enum. A suíte que provou os 5 critérios fica no glob do QA-09 e entra no commit do F0-05.

## Parecer SEC-07 — F0-03

Dado/ação envolvida: CPF/CNPJ em repouso, matriz de papéis, base legal automática, predicados de revogação e retenção
Sensibilidade: alta
Papéis com acesso e justificativa (menor privilégio): `vendedor` só na própria carteira; `gestor` na base e na promoção; `admin` na configuração; `auditor` somente leitura, inclusive trilha. Fonte única: `PERFIL_PERMISSOES`
Criptografia em repouso aplicada: sim — algoritmo: AES-256-GCM no valor e HMAC-SHA256 no hash indexado. Chave e pepper só por ambiente
Base legal registrada e não vazia: sim
Log de acesso gerado: não se aplica — não há listagem nem exportação nesta fase. O predicado `exportacaoBloqueada` já impede a saída quando `revogadoEm` existe
Step-up exigido: sim — em promoção a cliente, fusão, exportação e alteração de papel. A captura não pede. O TOTP em si chega na Fase 3; o guard já recusa sem a confirmação do servidor
Nova superfície de ataque introduzida: nenhuma. O teste injeta papel por middleware local; a API não lê papel de header
Veto exercido: não

## Parecer DQ-08 — F0-04

Regras de normalização aplicadas: telefone para E.164 assumindo +55 sem DDI; e-mail válido em minúsculas e trim; CPF/CNPJ só dígitos quando o DV confere; nome em Title Case preservando de, da, do, das, dos e e; CEP com 8 dígitos
Valores não normalizáveis: grava como veio + aviso (`TELEFONE_INVALIDO`, `EMAIL_INVALIDO`, `CPF_INVALIDO`, `CNPJ_INVALIDO`, `CEP_INVALIDO`). Nenhum caminho lança para rejeitar a captura
Pesos do score de completude: `PESOS_COMPLETUDE` em `apps/api/src/qualidade/completude.ts` — nome 20, documento válido 20, telefone 15, e-mail 10, endereço completo 15, tipo de pessoa definido 10, campos específicos 10. Endereço completo = logradouro + número + cidade + UF
Camadas de dedup ativas e seus limiares: nenhuma nesta fase. Dedup e merge são o F2-03
Falso positivo mais provável identificado: matriz e filial, ainda sem detector. Mitigação: não há fusão nem marca de duplicata neste card
Merge automático em algum caminho: não
Precedência de valor respeitada: sim — esta fase só normaliza o que chegou; não há enriquecimento escrevendo por cima
Ação necessária antes de seguir: a transição `rascunho → capturado` quando score ≥ 25 está na função pura. Quem persiste isso é a API da Fase 1

### Parecer QA-09

Categorias aplicadas: 1 funcional (persistir Ana, migração, tabela de score); 2 captura sem trava (um campo, CPF malformado, dois rascunhos com o mesmo CPF); 3 integridade (auditoria com valor anterior e novo, deleteOne recusado, update de auditoria recusado); 6 acesso (rota sem @Papel negada, auditor sem escrita, vendedor fora da carteira, exportação sem step-up). Exclusões: 4 offline — não há fila nem service worker de captura nesta fase (F1-02); 5 concorrência parcial — duas promoções simultâneas com o mesmo hash estão cobertas, dois usuários editando o mesmo contato e duplo POST HTTP ficam para a API da Fase 1; 7 dedup e merge — o card é F2-03 e não há fusão para testar
Testes escritos: `apps/api/test/f0-criterios.spec.ts`, `f0-migracao.spec.ts`, `f0-acesso.spec.ts`, `apps/web/src/App.test.tsx`, mais os specs de SEC-07 e DQ-08 que a suíte também executa. 49 testes de API e 1 de web, verdes neste host contra MongoDB 7.0.24 via mongodb-memory-server
Falhas encontradas: nenhuma na suíte. O `docker compose up` em máquina limpa deste host não passou sem regra de firewall local; isso não é teste automatizado e está no parecer do OPS-10
Falha silenciosa identificada (a mais perigosa): sim — o healthcheck do mongo passa dentro do container mesmo quando a API não completa TCP. A suíte não cobre essa rede. O log da API é explícito (`Server selection timed out`), não é sucesso falso de persistência
Cenários críticos cobertos nominalmente: `{ nome: "Ana" }` persiste; dois rascunhos com o mesmo CPF coexistem; qualificado duplicado devolve `CPF_DUPLICADO`; alteração de não-rascunho gera auditoria; `tipoPessoa` `INDEFINIDO` persiste; CPF malformado não bloqueia; `criadoPor` do cliente é descartado; rota sem papel é negada; tabela de 12 scores
Pronto para o portão REV-11: sim

### Portão REV-11

### Parecer Dev 1 — Correção funcional
- Aprovado com ressalvas
- Achados: `{ nome: "Ana" }` persiste; dois rascunhos com o mesmo CPF coexistem; promoção duplicada devolve `CPF_DUPLICADO` com mensagem em português, sem vazar E11000; CPF malformado grava e não bloqueia; a tabela de 12 scores é determinística e soma 100; valor que não normaliza volta com aviso e o bruto original. A função de completude devolve `capturado` quando o score passa de 25 e o status ainda é rascunho, mas ninguém persiste essa transição nesta fase.
- Ação necessária antes de produção: a API da Fase 1 precisa gravar a transição sugerida; o `docker compose up` em máquina limpa deste host não ficou verde (ver parecer OPS-10); o workflow de CI não foi executado no GitHub.

### Parecer Dev 2 — Integridade de dado e auditoria
- Aprovado com ressalvas
- Achados: alteração de contato que já não é rascunho gera uma linha por campo em `contatos_auditoria`, com valor anterior e novo; update e delete nessa coleção lançam erro; `deleteOne` em contato lança `ExclusaoFisicaProibida`; edição de rascunho não escreve trilha, como a seção 4.3 pede. Os doze índices da seção 4.4 existem. A unicidade de CPF/CNPJ é parcial. O filtro literal `$nin` não sobe no MongoDB 7.0.24; o ADR-007 grava o complemento fechado com `$in`. Autoria vinda do cliente é descartada e logada como `tentativa_autoria_cliente`.
- Ação necessária antes de produção: a trilha desta fase é plugin do Mongoose, não o interceptor HTTP da Fase 1. Rascunho pode nascer com `criadoPor` vazio enquanto não há sessão. Quem gravar contato pela API tem que injetar `autorId` no servidor antes de sair de rascunho.

### Parecer Dev 3 — Segurança e escala
- Aprovado com ressalvas
- Achados: CPF/CNPJ entram só por `$locals` e saem cifrados (AES-256-GCM) com hash HMAC-SHA256; o schema não tem campo em texto puro. Chave e pepper não estão no repositório. Rota sem `@Papel` responde 403 `PAPEL_INSUFICIENTE`. Exportação sem step-up do servidor responde `STEP_UP_NECESSARIO`. A API de produção não lê papel de header. A varredura de segredos passou neste host. Não há teste de volume: a coleção de desenvolvimento está vazia e `background: true` nos índices não foi medido com carga.
- Ação necessária antes de produção: o step-up desta fase é um flag do servidor, não TOTP (F3-01). Backup 3-2-1 continua no F3-04, sem RTO/RPO. O termo de consentimento segue aberto e trava F2-04 e F3-02, não esta fase. A proteção de branch no GitHub não foi aplicada daqui.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? sim — linha por campo em alteração de não-rascunho; a coleção de auditoria recusa update e delete.
2. Captura sem campo obrigatório? sim — um nome persiste, CPF inválido persiste, rascunho não é impedido.
3. Responsável identificado em toda ação? sim — não-rascunho sem autor é recusado; autoria do cliente é descartada; não há usuário fictício. Rascunho pode ficar sem `criadoPor` até existir sessão HTTP.
4. Estado de sincronização honesto? sim — o placeholder web não diz "Salvo" e não há fila local apresentada como persistida.
5. Carga cognitiva reduzida? sim — não há tela de captura nesta fase; o placeholder não pede campo.
6. Quebra fluxo existente? não — não havia fluxo de captura, dedup ou auditoria antes desta fundação.

VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado nas seis respostas; nenhuma reprovação automática]
Pendências antes de produção:
- `docker compose up` do zero não passou neste host sem regra ACCEPT no iptables-legacy do bridge, fora do repositório.
- GitHub Actions configurado e não executado daqui. Proteção de branch não aplicada.
- Transição de score, interceptor HTTP de auditoria, TOTP real, fila offline e backup 3-2-1 ficam nas fases seguintes.
- Termo de consentimento continua aberto em `.grok/ESCALONAMENTOS.md`.
Observação: este portão prepara o material de revisão e não substitui revisão humana quando exigida pelo processo da empresa.

### Estado
BOARD: BACKLOG 12 · EM CURSO 0 · EM REVISÃO 0 · FEITO 6
ADRs abertos neste ciclo: ADR-005 (configuração inicial), ADR-006 (esqueleto e composição por descoberta), ADR-007 (índice parcial com `$in`). ADR-004 passou de proposto para aceito e aplicado no F0-03.
Escalonamentos abertos: texto do termo de consentimento (SEC-07, 2026-09-25). Não trava a Fase 0.
Dívida técnica assumida conscientemente:
- A transição `rascunho → capturado` por score não é persistida.
- A auditoria é plugin do Mongoose; o interceptor HTTP fica para a API da Fase 1.
- Step-up é flag do servidor, não TOTP.
- `filaSincronizacao` é gancho; não há fila.
- Backup 3-2-1, Playwright e proteção de branch não foram feitos.
- O filtro de índice parcial executável é `$in`, não o `$nin` literal da seção 4.4.

### Como verificar você mesmo

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm test
bash infra/ci/varrer-segredos.sh
```

A suíte usa mongodb-memory-server (MongoDB 7) e não precisa de container. Para a migração contra um MongoDB já no ar:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/captura7 pnpm --filter @captura7/api migrate
```

Compose, a partir da raiz, sem arquivo de segredo:

```bash
docker compose up --build
curl -s http://127.0.0.1:3000/v1/saude
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5173
docker compose down
```

Neste host o `docker compose up` só ficou saudável depois de uma regra ACCEPT no iptables-legacy para o bridge do Compose. Essa regra não está no repositório. Sem ela, o mongo passa no healthcheck e a API estoura timeout de seleção de servidor.

### Autorização solicitada
Abrir FASE 1? [aguardando]

### O que ficou sem verificação

- O workflow `.github/workflows/ci.yml` não rodou no GitHub a partir deste ambiente. Lint, build, 49 testes de API, 1 teste de web e a varredura de segredos passaram neste host em 2026-09-25.
- A proteção de branch (check obrigatório no `main`) não foi configurada.
- `docker compose up` do zero, sem ajuste no host, não ficou verde. O mongo passou no healthcheck e a API não completou TCP até uma regra ACCEPT no iptables-legacy do bridge, fora do repositório. Depois dessa regra, `GET /v1/saude` respondeu `status ok` e o web entregou HTML em `127.0.0.1:5173`. Em seguida o Compose foi derrubado. Esse critério de máquina limpa não está verde.
- Backup, restauração, RTO e RPO não foram medidos. O card é o F3-04.
- Playwright e a pasta `e2e/` não têm suíte. Não há suíte vazia marcada como verde.
- TOTP real não existe. O guard só lê um flag do servidor.
- Volume dos índices com `background: true` não foi medido. A coleção usada nos testes nasce vazia.
