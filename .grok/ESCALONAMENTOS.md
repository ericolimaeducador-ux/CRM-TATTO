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

## [RESOLVIDO] 2026-09-25 — SEC-07 — Texto do termo de consentimento

⚠️ **O que estava em aberto:** o conteúdo jurídico do termo exibido no autocadastro
(`qr_proprio`) e no Google Forms, e quem o aprova.
⚠️ **Por que não podia decidir sozinho:** é texto com efeito jurídico perante titular de
dados. Redigi-lo por conta própria seria inventar base legal.
⚠️ **O que já verifiquei:** a minuta v2 entrou em `docs/lgpd/` sem alterar os
`[A PREENCHER]`. O agente não redigiu o texto.
⚠️ **Opções conhecidas (sem recomendar):** ficaram sem uso. O dono entregou a minuta.
→ **Resposta do usuário:** "Autorizo implementar as mudanças do termo no captura7." — 2026-09-26.

**O que esta resolução não faz:** naquela data não liberou uso externo. A autorização de 26/09/2026 às 17h26 BRT fechou o uso pessoal na ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — Minuta v2 ainda não vale para uso externo

⚠️ O que está em aberto: a minuta v2 precisa de revisão de advogado humano e de validação de UX antes de qualquer uso externo. Os campos `[A PREENCHER]` continuam no texto.
⚠️ Por que não posso decidir sozinho: o próprio cabeçalho da minuta diz que o apoio interno não substitui advogado. Inventar razão social, CNPJ, canal, prazo ou encarregado violaria a instrução do dono.
⚠️ O que já verifiquei: a tela usa o texto da minuta, inclusive os colchetes. A versão gravada é o literal `[A PREENCHER, D1]`.
⚠️ Opções conhecidas (sem recomendar): (a) advogado devolve o texto fechado e o dono autoriza a troca da versão; (b) a minuta permanece só em uso interno de desenvolvimento.
→ **Resposta do usuário:** "Autorizo o PR que libera tudo. Não tenho ERP por enquanto e vou rodar no meu computador." — 26/09/2026, 17h26 BRT. O termo passou a nomear a pessoa física, sem CNPJ. Ver ADR-010. Revisão de advogado para venda não se aplica: o produto não será vendido.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — D7 papel do fornecedor do ERP

⚠️ O que está em aberto: se o fornecedor do ERP é operador da 7Safe ou controlador separado. Sem isso não há caixa de consentimento para envio ao ERP nem base legal fechada da finalidade F3.
⚠️ Por que não posso decidir sozinho: a minuta condiciona a caixa à D7. Escolher operador ou controlador seria decidir pelo dono.
⚠️ O que já verifiquei: o webhook só envia contato com registro de consentimento da finalidade `envio_erp`. Essa finalidade não é coletada nesta entrega. Promoção sem esse registro fica `sem_consentimento` e não chama a rede.
⚠️ Opções conhecidas (sem recomendar): (a) operador, e o item vira informação sem caixa; (b) controlador separado, e a caixa de envio ao ERP passa a ser coletada; (c) o webhook permanece sem entrega até uma das duas.
→ **Resposta do usuário:** não há ERP. O webhook fica pronto e desligado com `ERP_WEBHOOK_URL` vazio. A caixa `envio_erp` é opcional. ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — D8 exportação continua bloqueada

⚠️ O que está em aberto: a finalidade da exportação (F3-02) e o texto `[FINALIDADE — A PREENCHER, DECISÃO D8]`.
⚠️ Por que não posso decidir sozinho: o dono manteve a D8 aberta e pediu para não implementar a exportação nem redigir texto jurídico extra.
⚠️ O que já verifiquei: não há rota de CSV, XLSX ou JSON. `GET /v1/exportacoes` segue inexistente. A função de portão recusaria registro sem consentimento da finalidade, mas a rota não existe.
⚠️ Opções conhecidas (sem recomendar): (a) o dono fecha a finalidade e autoriza o card; (b) a exportação permanece fora do produto.
→ **Resposta do usuário:** exportação CSV e XLSX liberada para o administrador, com auditoria, para uso pessoal. ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — D11 origem dos leads de planilha

⚠️ O que está em aberto: de onde vêm os contatos da planilha e como o titular é informado.
⚠️ Por que não posso decidir sozinho: a minuta marca a D11 como pendente. A base legal e o aviso ao titular dependem dessa resposta.
⚠️ O que já verifiquei: a importação grava `contatoComercial: pendente`, não copia coluna de consentimento e não marca o lead como consentido. Contato comercial e exportação ficam bloqueados.
⚠️ Opções conhecidas (sem recomendar): (a) há consentimento coletado fora do app e o dono descreve a prova; (b) outra base legal, indicada pelo dono; (c) os leads seguem pendentes e bloqueados.
→ **Resposta do usuário:** origem `importado`, base legal legítimo interesse, deduplicação sem fusão. O uso do lead importado fica liberado. ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — D1 D2 D5 D9 D12 e canais sem número

⚠️ O que está em aberto: razão social, CNPJ, endereço e versão oficial do termo (D1); encarregado (D2); canais de contato comercial (D5); prazos de guarda (D9); provedor de hospedagem e transferência internacional (D12); canal de revogação; proteção do registro offline no aparelho; confirmação do papel da Google no Sheets; nome do fornecedor do ERP.
⚠️ Por que não posso decidir sozinho: são dados da empresa e escolhas jurídicas. A minuta manda deixá-los como `[A PREENCHER]`.
⚠️ O que já verifiquei: o prazo de guarda da trilha lê `AUDITORIA_PRAZO_GUARDA_DIAS` e não tem valor padrão. Sem a variável, a rotina não apaga linha. Com a variável, também não apaga, porque a trilha é imutável.
⚠️ Opções conhecidas (sem recomendar): o dono preenche cada colchete na minuta e autoriza a substituição do texto.
→ **Resposta do usuário:** pessoa física Erico Henrique de Lima Araujo; e-mail em `CONTROLADOR_EMAIL`; o próprio controlador é o canal; retenção padrão de 24 meses; hospedagem no computador local. ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — Provedor de captcha do autocadastro

⚠️ O que está em aberto: qual provedor de captcha vale depois da terceira tentativa pública por IP.
⚠️ Por que não posso decidir sozinho: nenhum fornecedor foi nomeado. Inventar um criaria conta, segredo e tratamento de dado fora do pedido.
⚠️ O que já verifiquei: o limite é 10 pedidos por minuto por IP. Do quarto em diante a API responde `CAPTCHA_NAO_CONFIGURADO` e não grava o cadastro.
⚠️ Opções conhecidas (sem recomendar): (a) o dono indica o provedor e o contrato; (b) o autocadastro público segue com esse bloqueio a partir da quarta tentativa.
→ **Resposta do usuário:** desafio local de soma, sem conta externa. `CAPTCHA_PROVEDOR` troca por hCaptcha ou Turnstile. ADR-010.

---

## [RESOLVIDO] 2026-09-25 — API-03 — Campo `conflito` ausente no schema

⚠️ O que está em aberto: a seção 6 manda gravar as duas versões no campo `conflito` do contato. O schema publicado pelo ARQ-02 não tem esse campo, e o glob do API-03 não inclui `schemas/**`.
⚠️ Por que não posso decidir sozinho: criar o campo é decisão de modelo e pertence ao ARQ-02. Seguir sem o campo muda onde a segunda versão mora.
⚠️ O que já verifiquei: o PATCH condicional por `versao` não sobrescreve. A resposta 422 `CONFLITO_VERSAO` devolve o documento do servidor. A versão local permanece no IndexedDB, marcada para escolha humana. Não há fusão automática.
⚠️ Opções conhecidas (sem recomendar): (a) o ARQ-02 acrescenta `conflito` ao schema e a API passa a persistir as duas versões no servidor; (b) a escolha campo a campo continua só no aparelho até essa alteração.
→ **Resposta do usuário:** a autorização de 26/09/2026 às 17h26 BRT inclui fechar o campo. O servidor grava as duas versões. A escolha continua humana. ADR-010.

---

## [RESOLVIDO] 2026-09-26 — SEC-07 — Login para o step-up valer em produção

⚠️ O que está em aberto: em produção a API não emite sessão. O middleware ignora `x-papel-teste`, `x-usuario-id`, `x-autor-nome` e `x-step-up-teste` quando `NODE_ENV=production`. Sem usuário autenticado, o segredo TOTP não tem a quem se vincular e a promoção a cliente responde 403.
⚠️ Por que não posso decidir sozinho: nenhum card da fase 3 pede login, senha, JWT ou provedor de identidade. Criar um diretório de usuários seria escopo novo.
⚠️ O que já verifiquei: o verificador segue a RFC 6238, o segredo fica cifrado por usuário e o mesmo passo não é aceito de novo. Fora de produção a sessão de teste inscreve e promove com código real. Com a API no ar em `NODE_ENV=production`, o cabeçalho de teste não autentica nem promove.
⚠️ Opções conhecidas (sem recomendar): (a) o dono indica um provedor de identidade e o contrato da sessão; (b) um diretório local com senha, em card próprio; (c) o step-up continua utilizável só onde já existe sessão, e em produção fica inalcançável até essa sessão existir.
→ **Resposta do usuário:** diretório local com senha em scrypt e o TOTP já existente. O primeiro administrador nasce com `pnpm criar-admin`. ADR-010.
