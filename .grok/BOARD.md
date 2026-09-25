# BOARD — captura7

Regra: **trabalho sem card aqui não acontece.** O CC-00 cria os cards, o ORQ-01 move,
o agente responsável executa, o QA-09 valida, o REV-11 fecha.

Formato do card:
`[ID] título — @agente — aceite: <critério verificável> — dep: [IDs]`

---

## BACKLOG

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 1."

### Fase 1 — Captura

- `[F1-07]` Portão de revisão da Fase 1 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_1.md — dep: [F1-06]

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

- `[F1-01]` API de contatos: POST/PATCH idempotente por `idLocal`, PATCH parcial campo-a-campo — **@API-03** — aceite: reenvio do mesmo `idLocal` não duplica; score ≥ 25 persiste `capturado`; autoria só do servidor — dep: [F0-06] — observação: 10 testes HTTP verdes; conflito de versão não grava o campo `conflito` porque ele não está no schema (escalonado)
- `[F1-02]` Fila offline: IndexedDB + worker de sync com backoff e resolução de conflito — **@SCAN-05** — aceite: grava local antes da rede e a profundidade alimenta `filaSincronizacao` — dep: [F1-01] — observação: IndexedDB antes do fetch; backoff até 5 min sem desistir; alerta a partir da 10ª falha; profundidade vai no lote
- `[F1-03]` Leitura de QR: BarcodeDetector API com fallback ZXing; parsers vCard 2.1/3.0, MeCard, URL, texto livre — **@SCAN-05** — aceite: payload irreconhecível abre o formulário e guarda `payloadBruto` — dep: [F1-02] — observação: BarcodeDetector, senão ZXing, e o botão de digitar permanece na mesma tela
- `[F1-04]` Tela de captura: cartões colapsáveis, autosave, zero campo obrigatório, alvo de toque ≥ 48px — **@UI-04** — aceite: caminho mínimo em até dois toques, sem campo obrigatório — dep: [F1-01, F1-03] — observação: um toque em Digitar e o nome com foco; cartões fechados; sem botão de salvar desabilitado
- `[F1-05]` Indicador de sincronização sempre visível (nunca "parece salvo") — **@UI-04** + **@SCAN-05** — aceite: só `Salvo neste aparelho`, `Enviando…` ou `Sincronizado` — dep: [F1-02, F1-04] — observação: barra, formulário, lista e fila; preso oferece exportar JSON; conflito pede escolha humana
- `[F1-06]` Testes das categorias 1 a 6, com Playwright e rede simulada — **@QA-09** — aceite: lead capturado em avião chega sem duplicata depois de reabrir e reconectar — dep: [F1-05] — observação: suíte escrita; a execução real entra no parecer antes do portão. Categoria 7 fica fora, no F2-03

## FEITO

- `[F0-01]` Bootstrap do repositório (monorepo pnpm, apps/api + apps/web, Docker Compose, lint, husky) — **@OPS-10** — aceite: `docker compose up` sobe api+web+mongo e `pnpm build` passa nos dois apps — dep: [] — observação: `pnpm lint` e `pnpm build` verdes neste host; o Compose só subiu os três serviços depois de regra ACCEPT no bridge (iptables-legacy do host, fora do repositório). Critério de máquina limpa não ficou verde
- `[F0-02]` Schemas Mongoose `Contato` e `ContatoAuditoria` + índices — **@ARQ-02** — aceite: os 5 critérios listados abaixo — dep: [F0-01] — observação: critérios verdes contra MongoDB 7 em memória na suíte do F0-05. Índice parcial usa `$in` (ADR-007)
- `[F0-03]` Revisão LGPD do schema (bloco `lgpd`, campos criptografados em repouso, política de retenção) — **@SEC-07** — aceite: ADR de criptografia de CPF/CNPJ publicado e aplicado — dep: [F0-02] — observação: ADR-004 aceito; guard nega rota sem decorator; cifra testada no schema
- `[F0-04]` Serviço de completude e normalização (E.164, CPF/CNPJ, e-mail lowercase, nome título) — **@DQ-08** — aceite: score determinístico com teste de tabela cobrindo 12 combinações — dep: [F0-02] — observação: tabela de 12 linhas verde; valor que não normaliza é gravado como veio
- `[F0-05]` Plano de testes da Fase 0 — **@QA-09** — aceite: suíte roda em CI e cobre os 5 critérios de F0-02 — dep: [F0-02, F0-04] — observação: suíte verde neste host; workflow do GitHub Actions existe e não foi executado daqui
- `[F0-06]` Portão de revisão da Fase 0 — **@REV-11** — aceite: veredito consolidado em PROGRESS_FASE_0.md — dep: [F0-05] — observação: APROVADO COM RESSALVAS. O portão prepara revisão e não substitui revisão humana

**Critérios de aceite de `F0-02`:**
1. Salvar `{ nome: "Ana" }` persiste sem erro de validação
2. Dois rascunhos com o mesmo CPF coexistem
3. Promover para `qualificado` com CPF já existente em outro contato não-rascunho é rejeitado com erro nomeado (`CPF_DUPLICADO`), não exceção genérica do Mongo
4. Alteração em documento não-rascunho gera linha em `contatos_auditoria` com valor anterior e novo
5. `tipoPessoa` default é `INDEFINIDO` e é estado persistível
