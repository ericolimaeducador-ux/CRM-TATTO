# BOARD — captura7

Regra: **trabalho sem card aqui não acontece.** O CC-00 cria os cards, o ORQ-01 move,
o agente responsável executa, o QA-09 valida, o REV-11 fecha.

Formato do card:
`[ID] título — @agente — aceite: <critério verificável> — dep: [IDs]`

---

## BACKLOG

### Fase 0 — Fundação

- `[F0-02]` Schemas Mongoose `Contato` e `ContatoAuditoria` + índices — **@ARQ-02** — aceite: os 5 critérios do card F0-02 abaixo — dep: [F0-01]
- `[F0-03]` Revisão LGPD do schema (bloco `lgpd`, campos criptografados em repouso, política de retenção) — **@SEC-07** — aceite: ADR de criptografia de CPF/CNPJ publicado e aplicado — dep: [F0-02]
- `[F0-04]` Serviço de completude e normalização (E.164, CPF/CNPJ, e-mail lowercase, nome título) — **@DQ-08** — aceite: score determinístico com teste de tabela cobrindo 12 combinações — dep: [F0-02]
- `[F0-05]` Plano de testes da Fase 0 — **@QA-09** — aceite: suíte roda em CI e cobre os 5 critérios de F0-02 — dep: [F0-02, F0-04]
- `[F0-06]` Portão de revisão da Fase 0 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_0.md — dep: [F0-05]

**Critérios de aceite detalhados de `F0-02`:**
1. Salvar `{ nome: "Ana" }` persiste sem erro de validação
2. Dois rascunhos com o mesmo CPF coexistem
3. Promover para `qualificado` com CPF já existente em outro contato não-rascunho é rejeitado com erro nomeado (`CPF_DUPLICADO`), não exceção genérica do Mongo
4. Alteração em documento não-rascunho gera linha em `contatos_auditoria` com valor anterior e novo
5. `tipoPessoa` default é `INDEFINIDO` e é estado persistível

### Fase 1 — Captura (não abrir sem F0 fechada)

- `[F1-01]` API de contatos: POST/PATCH idempotente por `idLocal`, PATCH parcial campo-a-campo — **@API-03**
- `[F1-02]` Fila offline: IndexedDB + worker de sync com backoff e resolução de conflito — **@SCAN-05**
- `[F1-03]` Leitura de QR: BarcodeDetector API com fallback ZXing; parsers vCard 2.1/3.0, MeCard, URL, texto livre — **@SCAN-05**
- `[F1-04]` Tela de captura: cartões colapsáveis, autosave, zero campo obrigatório, alvo de toque ≥ 48px — **@UI-04**
- `[F1-05]` Indicador de sincronização sempre visível (nunca "parece salvo") — **@UI-04** + **@SCAN-05**

### Fase 2 — Enriquecimento e ingestão

- `[F2-01]` Enriquecimento CNPJ (BrasilAPI, fallback ReceitaWS) e CEP (ViaCEP) com cache e circuit breaker — **@INT-06**
- `[F2-02]` Ingestão Google Sheets por polling (ver ADR-003) — **@INT-06**
- `[F2-03]` Deduplicação fuzzy + tela de sugestão de merge — **@DQ-08** + **@UI-04**
- `[F2-04]` QR próprio + formulário público de autocadastro com termo de consentimento versionado — **@UI-04** + **@SEC-07**

### Fase 3 — Saída controlada

- `[F3-01]` Fluxo de promoção lead → cliente com validação estrita e step-up TOTP — **@API-03** + **@SEC-07**
- `[F3-02]` Exportação CSV/XLSX/JSON com log de exportação (quem levou qual base, quando) — **@INT-06** + **@SEC-07**
- `[F3-03]` Webhook de saída para o ERP (ver ADR-002) — **@INT-06**

---

## EM CURSO

_(vazio)_

## EM REVISÃO

- `[F0-01]` Bootstrap do repositório (monorepo pnpm, apps/api + apps/web, Docker Compose, lint, husky) — **@OPS-10** — aceite: `docker compose up` sobe api+web+mongo e `pnpm build` passa nos dois apps — dep: [] — observação: `pnpm lint`, `pnpm build` e `pnpm test` verdes; Compose subiu os três serviços neste host só depois de regra ACCEPT no bridge (iptables-legacy do host, fora do repositório)

## FEITO

_(vazio)_
