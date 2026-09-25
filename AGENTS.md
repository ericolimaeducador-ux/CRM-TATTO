# captura7 — Índice de Agentes

PWA offline-first de captura de leads e clientes (PF/PJ) por QR code, digitação manual
e Google Forms. Ecossistema 7Safe.

## Princípio de governança

> **Entrada permissiva, saída controlada.**
> A tela de captura não tem campo obrigatório. O controle existe na promoção
> lead → cliente, nunca no momento da coleta.

## Como falar com o sistema

Você fala **sempre com o CC-00 (Centro de Comandos)**. Ele decompõe, roteia e devolve.
Não acione um agente executor diretamente a menos que queira um ajuste cirúrgico.

```
CENTRO DE COMANDOS: <o que você quer>
```

## Cadeia de comando

```
CC-00 Centro de Comandos          ← você fala aqui
   └── ORQ-01 Orquestrador do App ← dono do contrato, sequencia e resolve conflito
         ├── ARQ-02  Arquitetura de Dados
         ├── API-03  Backend NestJS
         ├── UI-04   Frontend PWA
         ├── SCAN-05 Captura & Offline
         ├── INT-06  Integrações
         ├── SEC-07  Segurança & LGPD
         ├── DQ-08   Qualidade de Dado
         ├── QA-09   Qualidade & Testes
         └── OPS-10  Infra & Deploy
               └── REV-11 Portão de Revisão  ← último, sempre
```

## Tabela de acionamento

| ID | Agente | Acione quando |
|---|---|---|
| CC-00 | Centro de Comandos | Sempre. É a porta de entrada. |
| ORQ-01 | Orquestrador do App | Automático. Conflito entre agentes, sequência de fases. |
| ARQ-02 | Arquitetura de Dados | Schema, índice, migração, relacionamento, trilha de auditoria no banco |
| API-03 | Backend NestJS | Endpoint, DTO, serviço, validação, idempotência, fila de sync |
| UI-04 | Frontend PWA | Tela, formulário, navegação, estado, acessibilidade, design system |
| SCAN-05 | Captura & Offline | Câmera, QR, vCard, IndexedDB, fila, conflito de sincronização |
| INT-06 | Integrações | Google Forms/Sheets, BrasilAPI, ViaCEP, webhook, export CSV/XLSX |
| SEC-07 | Segurança & LGPD | Auth, RBAC, criptografia, base legal, retenção, log de acesso |
| DQ-08 | Qualidade de Dado | Dedup, normalização, score de completude, merge, enriquecimento |
| QA-09 | Qualidade & Testes | Antes de qualquer entrega ser chamada de pronta |
| OPS-10 | Infra & Deploy | Docker, ambiente, HTTPS, backup, monitoramento |
| REV-11 | Portão de Revisão | Toda entrega, sem exceção, antes de produção |

## Arquivos de estado

| Arquivo | Para quê |
|---|---|
| `.grok/BOARD.md` | Kanban. Toda tarefa entra e sai por aqui. |
| `.grok/DECISOES.md` | ADRs numerados. Decisão sem ADR não existe. |
| `.grok/ESCALONAMENTOS.md` | O que precisa da decisão do Erico. Bloqueia implementação. |
| `.grok/config.md` | Model ID em uso e como trocar. |
| `PROGRESS_FASE_N.md` | Progresso da fase corrente. |
