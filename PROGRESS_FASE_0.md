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
| F0-01 Bootstrap | OPS-10 | em revisão | build e lint verdes; Compose não fechou em máquina limpa neste host |
| F0-02 Schemas + índices | ARQ-02 | ⬜ não iniciado | |
| F0-03 Revisão LGPD | SEC-07 | ⬜ não iniciado | depende de ADR-004 |
| F0-04 Completude e normalização | DQ-08 | ⬜ não iniciado | |
| F0-05 Plano de testes | QA-09 | ⬜ não iniciado | |
| F0-06 Portão | REV-11 | ⬜ não iniciado | |

## Parecer OPS-10 — F0-01

Ambiente/pipeline tocado: monorepo pnpm (`apps/api` NestJS 10, `apps/web` React 18 + Vite), Docker Compose, GitHub Actions, ESLint, Prettier, husky, lint-staged, `.env.example`
`docker compose up` do zero funciona: não
TLS configurado: não se aplica
Backup: frequência não definida · criptografado não · destino externo não definido · regra 3-2-1 não
Restauração testada: não — RTO não declarado · RPO não declarado
Segredo fora do repositório: sim
Alertas ativos: nenhum em produção. `GET /v1/saude` expõe `filaSincronizacao` e o gancho avisa se a profundidade subir; a fila real é da Fase 1
Ação necessária antes de seguir: o comando único construiu as imagens e o mongo ficou healthy. A API não abriu TCP com o mongo porque o iptables-legacy deste host (FORWARD em DROP) descartava o bridge do Compose, enquanto o daemon tinha escrito a regra no nftables. Uma regra ACCEPT só nesta máquina fez os três subirem: `/v1/saude` respondeu `status ok` e o web entregou o HTML em `127.0.0.1:5173`. Essa regra não entra no repositório. Backup continua sendo o F3-04. A proteção de branch no GitHub (check obrigatório) não foi aplicada daqui.

## Veredito do Portão

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
