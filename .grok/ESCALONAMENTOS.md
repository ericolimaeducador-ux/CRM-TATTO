# Escalonamentos — decisões que dependem do Erico

Um agente que grava aqui **não implementa o trecho dependente** até haver resposta.

Formato:

```
## [ABERTO|RESOLVIDO] AAAA-MM-DD — <ID do agente> — <título curto>
⚠️ O que está em aberto:
⚠️ Por que não posso decidir sozinho:
⚠️ O que já verifiquei:
⚠️ Opções conhecidas (sem recomendar):
→ Resposta do usuário (preencher quando houver):
```

---

## [RESOLVIDO] 2026-09-25 — ORQ-01 — Três premissas assumidas por default

⚠️ **O que estava em aberto:** desenho da captura sem travas, vínculo com o ERP da Sette,
rota de ingestão do Google Forms.
⚠️ **Resolução:** o usuário autorizou prosseguir sem responder item a item. Assumidos os
defaults conservadores registrados em ADR-001, ADR-002 e ADR-003, todos marcados como
reversíveis a baixo custo.
→ **Resposta do usuário:** "vamos fazer" — 2026-09-25.
**Revisitar** ADR-002 assim que o módulo de clientes do ERP existir.

---

## [ABERTO] 2026-09-25 — SEC-07 — Texto do termo de consentimento

⚠️ **O que está em aberto:** o conteúdo jurídico do termo exibido no autocadastro
(`qr_proprio`) e no Google Forms, e quem o aprova.
⚠️ **Por que não posso decidir sozinho:** é texto com efeito jurídico perante titular de
dados. Redigi-lo por conta própria seria inventar base legal — vedado pela regra G de
`010-integridade.mdc`.
⚠️ **O que já verifiquei:** o schema suporta `lgpd.consentimentoTexto` e
`lgpd.versaoTermo`; a mecânica de versionamento está pronta e independe do texto.
⚠️ **Opções conhecidas (sem recomendar):** (a) texto redigido e aprovado por assessoria
jurídica da 7Safe; (b) texto provisório marcado `versaoTermo: "RASCUNHO-NAO-JURIDICO"`,
bloqueando exportação até substituição.
→ **Resposta do usuário:**

**Impacto do bloqueio:** os cards F2-04 e F3-02 não fecham sem isso. A Fase 0 e a Fase 1
seguem normalmente.

---

## [ABERTO] 2026-09-25 — API-03 — Campo `conflito` ausente no schema

⚠️ O que está em aberto: a seção 6 manda gravar as duas versões no campo `conflito` do contato. O schema publicado pelo ARQ-02 não tem esse campo, e o glob do API-03 não inclui `schemas/**`.
⚠️ Por que não posso decidir sozinho: criar o campo é decisão de modelo e pertence ao ARQ-02. Seguir sem o campo muda onde a segunda versão mora.
⚠️ O que já verifiquei: o PATCH condicional por `versao` não sobrescreve. A resposta 422 `CONFLITO_VERSAO` devolve o documento do servidor. A versão local permanece no IndexedDB, marcada para escolha humana. Não há fusão automática.
⚠️ Opções conhecidas (sem recomendar): (a) o ARQ-02 acrescenta `conflito` ao schema e a API passa a persistir as duas versões no servidor; (b) a escolha campo a campo continua só no aparelho até essa alteração.
→ Resposta do usuário (preencher quando houver):
