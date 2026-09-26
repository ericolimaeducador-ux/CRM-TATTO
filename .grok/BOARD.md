# BOARD — captura7

Regra: **trabalho sem card aqui não acontece.** O CC-00 cria os cards, o ORQ-01 move,
o agente responsável executa, o QA-09 valida, o REV-11 fecha.

Formato do card:
`[ID] título — @agente — aceite: <critério verificável> — dep: [IDs]`

---

## BACKLOG

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 1."

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 2."

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 3."

Autorização escrita do dono (Professor Erico), 2026-09-26: "Autorizo implementar as mudanças do termo no captura7."

### Fase 3 — Saída controlada

- `[F3-02]` Exportação CSV/XLSX/JSON com log de exportação (quem levou qual base, quando) — **@INT-06** + **@SEC-07** — **BLOQUEADO** — D8 aberta; sem rota e sem arquivo neste ciclo

### Ciclo do termo — depois da parada 4

- `[T-00]` Registrar a autorização, a ADR-008 e a minuta v2 sem preencher colchetes — **@CC-00** — aceite: a autorização de 2026-09-26 está no board e a minuta em `docs/lgpd/` conserva `[A PREENCHER]` — dep: []
- `[T-01]` Consentimento no schema e trilha só com identificador pseudonimizado — **@ARQ-02** — aceite: alteração de não-rascunho não grava nome em claro; update da trilha continua impossível — dep: [T-00]
- `[T-02]` Registro, revogação, eliminação e autocadastro público — **@SEC-07** — aceite: concluir autocadastro sem a caixa falha e não grava; eliminação não reescreve a trilha — dep: [T-01]
- `[T-03]` QSA fora do payload, planilha pendente e webhook só com consentimento de ERP — **@INT-06** — aceite: o nome de sócio não aparece no cache nem no contato; planilha não fica consentida; sem `envio_erp` não há POST — dep: [T-02]
- `[T-04]` Mesma tela de autorizações na captura e no QR, com destaque e botão condicional — **@UI-04** — aceite: a captura salva com pendente visível; "Concluir cadastro" nasce desabilitado — dep: [T-02]
- `[T-05]` Bateria do termo e regressão das fases anteriores — **@QA-09** — aceite: lint, build, Jest, Vitest, Playwright e varredura de segredos executados neste host — dep: [T-03, T-04]
- `[T-06]` Portão do ciclo do termo — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_TERMO.md — dep: [T-05]

---

## EM CURSO

- `[F2-04]` QR próprio + formulário público de autocadastro com termo de consentimento versionado — **@UI-04** + **@SEC-07** — aceite: a URL pública mostra a minuta e só conclui com a caixa de contato comercial — dep: [F2-01]

## EM REVISÃO

_(vazio)_

## FEITO

- `[F0-01]` Bootstrap do repositório (monorepo pnpm, apps/api + apps/web, Docker Compose, lint, husky) — **@OPS-10** — aceite: `docker compose up` sobe api+web+mongo e `pnpm build` passa nos dois apps — dep: [] — observação: `pnpm lint` e `pnpm build` verdes neste host; o Compose só subiu os três serviços depois de regra ACCEPT no bridge (iptables-legacy do host, fora do repositório). Critério de máquina limpa não ficou verde
- `[F0-02]` Schemas Mongoose `Contato` e `ContatoAuditoria` + índices — **@ARQ-02** — aceite: os 5 critérios listados abaixo — dep: [F0-01] — observação: critérios verdes contra MongoDB 7 em memória na suíte do F0-05. Índice parcial usa `$in` (ADR-007)
- `[F0-03]` Revisão LGPD do schema (bloco `lgpd`, campos criptografados em repouso, política de retenção) — **@SEC-07** — aceite: ADR de criptografia de CPF/CNPJ publicado e aplicado — dep: [F0-02] — observação: ADR-004 aceito; guard nega rota sem decorator; cifra testada no schema
- `[F0-04]` Serviço de completude e normalização (E.164, CPF/CNPJ, e-mail lowercase, nome título) — **@DQ-08** — aceite: score determinístico com teste de tabela cobrindo 12 combinações — dep: [F0-02] — observação: tabela de 12 linhas verde; valor que não normaliza é gravado como veio
- `[F0-05]` Plano de testes da Fase 0 — **@QA-09** — aceite: suíte roda em CI e cobre os 5 critérios de F0-02 — dep: [F0-02, F0-04] — observação: suíte verde neste host; workflow do GitHub Actions existe e não foi executado daqui
- `[F0-06]` Portão de revisão da Fase 0 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_0.md — dep: [F0-05] — observação: APROVADO COM RESSALVAS. O portão prepara revisão e não substitui revisão humana
- `[F1-01]` API de contatos: POST/PATCH idempotente por `idLocal`, PATCH parcial campo-a-campo — **@API-03** — aceite: reenvio do mesmo `idLocal` não duplica; score ≥ 25 persiste `capturado`; autoria só do servidor — dep: [F0-06] — observação: 10 testes HTTP verdes; conflito de versão não grava o campo `conflito` porque ele não está no schema (escalonado)
- `[F1-02]` Fila offline: IndexedDB + worker de sync com backoff e resolução de conflito — **@SCAN-05** — aceite: grava local antes da rede e a profundidade alimenta `filaSincronizacao` — dep: [F1-01] — observação: IndexedDB antes do fetch; backoff até 5 min sem desistir; alerta a partir da 10ª falha; profundidade vai no lote
- `[F1-03]` Leitura de QR: BarcodeDetector API com fallback ZXing; parsers vCard 2.1/3.0, MeCard, URL, texto livre — **@SCAN-05** — aceite: payload irreconhecível abre o formulário e guarda `payloadBruto` — dep: [F1-02] — observação: BarcodeDetector, senão ZXing, e o botão de digitar permanece na mesma tela. Câmera física não exercitada
- `[F1-04]` Tela de captura: cartões colapsáveis, autosave, zero campo obrigatório, alvo de toque ≥ 48px — **@UI-04** — aceite: caminho mínimo em até dois toques, sem campo obrigatório — dep: [F1-01, F1-03] — observação: um toque em Digitar e o nome com foco; cartões fechados; sem botão de salvar desabilitado
- `[F1-05]` Indicador de sincronização sempre visível (nunca "parece salvo") — **@UI-04** + **@SCAN-05** — aceite: só `Salvo neste aparelho`, `Enviando…` ou `Sincronizado` — dep: [F1-02, F1-04] — observação: barra, formulário, lista e fila; preso oferece exportar JSON; conflito pede escolha humana
- `[F1-06]` Testes das categorias 1 a 6, com Playwright e rede simulada — **@QA-09** — aceite: lead capturado em avião chega sem duplicata depois de reabrir e reconectar — dep: [F1-05] — observação: Playwright verde neste host. Categoria 7 fica no F2-03. GitHub Actions não rodou daqui
- `[F1-07]` Portão de revisão da Fase 1 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_1.md — dep: [F1-06] — observação: APROVADO COM RESSALVAS. O portão prepara revisão e não substitui revisão humana
- `[F2-01]` Enriquecimento CNPJ (BrasilAPI, fallback ReceitaWS) e CEP (ViaCEP) com cache e circuit breaker — **@INT-06** — aceite: fonte oficial sugere e não sobrescreve; falha não trava a captura — dep: [F1-07] — observação: contratos BrasilAPI, ReceitaWS e ViaCEP cobertos com mock; a rede externa não é chamada no teste
- `[F2-02]` Ingestão Google Sheets por polling (ver ADR-003) — **@INT-06** — aceite: reprocessar a planilha inteira não duplica — dep: [F2-01] — observação: contrato ValueRange com mock; ponta a ponta no Google espera credencial do dono
- `[F2-03]` Deduplicação fuzzy + tela de sugestão de merge — **@DQ-08** + **@UI-04** — aceite: matriz/filial não é duplicata; merge sem confirmação é impossível; absorvido recuperável por 90 dias — dep: [F2-01] — observação: sem fusão automática; o campo `conflito` continua escalonado e não foi necessário
- `[F2-05]` Testes das categorias 1 a 7, com Playwright — **@QA-09** — aceite: suítes das fases anteriores seguem verdes e a categoria 7 cobre matriz/filial, merge sem confirmação e recuperação em 90 dias — dep: [F2-03] — observação: Playwright 5 testes verdes neste host, incluindo avião e a tela de fusão. GitHub Actions não rodou daqui
- `[F2-06]` Portão de revisão da Fase 2 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_2.md — dep: [F2-05] — observação: APROVADO COM RESSALVAS. O portão prepara revisão e não substitui revisão humana
- `[F3-01]` Fluxo de promoção lead → cliente com validação estrita e step-up TOTP — **@API-03** + **@SEC-07** — aceite: código RFC 6238 promove; o mesmo passo não repete; com `NODE_ENV=production` o cabeçalho de teste não autentica — dep: [F2-06] — observação: segredo cifrado por usuário; janela ±1 passo de 30s; login de produção escalonado porque nenhum card pede emissão de sessão
- `[F3-03]` Webhook de saída genérico (ADR-002) — **@INT-06** — aceite: HMAC, idempotência por contato e versão, retentativa com backoff, fila de falhas e log; URL e segredo só por ambiente — dep: [F3-01] — observação: nenhum fornecedor foi nomeado; sem destino a promoção segue e a entrega fica `nao_configurado`
- `[F3-04]` Backup 3-2-1 testado e cronometrado — **@OPS-10** — aceite: dump cifrado, restauração em base limpa, contagem e amostra da auditoria, RTO/RPO medidos — dep: [F3-03] — observação: ensaio neste host RPO 29 ms e RTO 19 ms em 1 contato e 1 linha de auditoria (anterior: 26 ms e 15 ms). 3-2-1 não atendida: falta o bucket do dono. `docker compose up` não rodou; o socket negou permissão
- `[F3-05]` Testes completos — **@QA-09** — aceite: suítes das fases anteriores seguem verdes, com TOTP, webhook e a tela de promoção — dep: [F3-04] — observação: Jest 17/88, Vitest 6/14, Playwright 6. GitHub Actions não rodou daqui
- `[F3-06]` Portão final — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_3.md — dep: [F3-05] — observação: APROVADO COM RESSALVAS. O portão prepara revisão e não substitui revisão humana. Parada 4.

**Critérios de aceite de `F0-02`:**
1. Salvar `{ nome: "Ana" }` persiste sem erro de validação
2. Dois rascunhos com o mesmo CPF coexistem
3. Promover para `qualificado` com CPF já existente em outro contato não-rascunho é rejeitado com erro nomeado (`CPF_DUPLICADO`), não exceção genérica do Mongo
4. Alteração em documento não-rascunho gera linha em `contatos_auditoria` com valor anterior e novo
5. `tipoPessoa` default é `INDEFINIDO` e é estado persistível
