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
| F0-01 Bootstrap | OPS-10 | ⬜ não iniciado | |
| F0-02 Schemas + índices | ARQ-02 | ⬜ não iniciado | |
| F0-03 Revisão LGPD | SEC-07 | ⬜ não iniciado | depende de ADR-004 |
| F0-04 Completude e normalização | DQ-08 | ⬜ não iniciado | |
| F0-05 Plano de testes | QA-09 | ⬜ não iniciado | |
| F0-06 Portão | REV-11 | ⬜ não iniciado | |

## Veredito do Portão

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
