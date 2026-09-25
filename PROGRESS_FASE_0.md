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
| F0-02 Schemas + índices | ARQ-02 | em revisão | 5 critérios verdes em MongoDB 7; índice parcial em ADR-007 |
| F0-03 Revisão LGPD | SEC-07 | em revisão | ADR-004 aceito; guard e cifra verdes |
| F0-04 Completude e normalização | DQ-08 | em revisão | tabela de 12 combinações verde |
| F0-05 Plano de testes | QA-09 | em revisão | 50 testes verdes neste host |
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

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
