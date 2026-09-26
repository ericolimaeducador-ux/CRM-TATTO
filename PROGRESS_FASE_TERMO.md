# Progresso — ciclo do termo (depois da parada 4)

Autorização escrita do dono (Professor Erico), 2026-09-26: "Autorizo implementar as mudanças do termo no captura7."

Este ciclo não reabre as fases 0 a 3 e não faz merge. A base é `cursor/fase-3-captura7`. Pull request: https://github.com/ericolimaeducador-ux/CRM-TATTO/pull/5

A minuta v2 está em `docs/lgpd/TERMO_CONSENTIMENTO_CAPTURA7_minuta_v2.md`, copiada sem preencher `[A PREENCHER]`. **Não está liberada para uso externo.** Falta revisão de advogado humano e validação de UX.

## Despacho CC-00 — 2026-09-26

Pedido recebido: implementar o termo de consentimento com as decisões D3, D4, D6 e D10, sem decidir o que continua aberto.
Interpretação adotada: o rascunho salva com consentimento pendente (ADR-008); contato comercial, ERP e exportação bloqueiam até o registro daquela finalidade; a conclusão do autocadastro exige a caixa.

Cards criados:
| ID | Título | Agente | Aceite | Dep |
|---|---|---|---|---|
| T-00 | Autorização, ADR-008 e minuta | CC-00 | autorização no board e minuta com colchetes | [] |
| T-01 | Schema e trilha pseudonimizada | ARQ-02 | nome não entra em claro na trilha | T-00 |
| T-02 | Registro, revogação, eliminação, autocadastro | SEC-07 | sem caixa não conclui; eliminação não reescreve a trilha | T-01 |
| T-03 | QSA, planilha pendente, webhook | INT-06 | sócio não persiste; sem envio_erp não há POST | T-02 |
| T-04 | Telas da mesma autorização | UI-04 | pendente visível; botão nasce desabilitado | T-02 |
| T-05 | Bateria | QA-09 | lint, build, Jest, Vitest, Playwright, segredos | T-03, T-04 |
| T-06 | Portão | REV-11 | veredito neste arquivo | T-05 |

Cards bloqueados por escalonamento: F3-02 (D8). D1, D2, D5, D7, D9, D11, D12 e os colchetes sem número seguem abertos e não foram preenchidos.
Despachado para: ORQ-01

## Executado

| Card | Resultado neste host, 2026-09-26 |
|---|---|
| T-00 | Autorização no board. ADR-008 aceita. Minuta com os colchetes. |
| T-01 | `contatoComercial` e `consentimentos`. Trilha com HMAC. Update da auditoria continua impossível. |
| T-02 | Registro, revogação, eliminação (Art. 18, VI) e `POST /v1/publico/autocadastro`. Sem a caixa, nada é gravado. |
| T-03 | QSA, e-mail e telefone da base oficial não entram no payload guardado. Planilha fica pendente. Webhook sem `envio_erp` fica `sem_consentimento`. |
| T-04 | Captura com pendente visível. Mesma tela no QR. Botão nasce desabilitado. |
| T-05 | lint, build, Jest 18 suítes / 93 testes, Vitest 7 arquivos / 15 testes, Playwright 7, varredura limpa. |
| T-06 | APROVADO COM RESSALVAS. |

## Parecer ARQ-02 — T-01

Entidades tocadas: `Contato.lgpd`, `contatos_auditoria`
Campos adicionados/alterados: `contatoComercial` (`pendente|concedido|revogado`, padrão pendente), `consentimentos[]` (finalidade, horários do aparelho e do servidor, versão, hash, canal, `responsavelId`), `eliminadoEm`. Valores pessoais da trilha e `autorNome` passam a HMAC-SHA256 com o pepper.
Índices criados (e por que cada um existe): nenhum novo no contato. O token de QR tem índice único em `tokens_autocadastro.token`, fora do glob do schema de contato, para o mesmo QR não nascer duas vezes.
Risco de perda de histórico identificado: nenhum. A eliminação não altera linha antiga da trilha. A linha nova da eliminação não contém o nome em claro.
Compatibilidade com ADR-001 (índice parcial) verificada: sim. O índice de CPF/CNPJ não mudou.
Migração reversível: não — não há arquivo de migração. Documento antigo sem `contatoComercial` é lido como pendente nas portas de saída.
Ação necessária antes de seguir: nenhuma no schema. O campo `conflito` continua fora.

## Parecer API-03 — T-02

Rotas criadas/alteradas: `GET /v1/publico/termo/atual` e `GET /v1/publico/termo/:versao` públicas; `POST /v1/publico/autocadastro` pública; `POST /v1/qr` vendedor, gestor, admin; `POST /v1/contatos/:id/consentimento` e `POST /v1/contatos/:id/contato-comercial` quem edita; `POST /v1/contatos/:id/revogacao` e `POST /v1/contatos/:id/eliminacao` gestor, admin.
Validação: avisos de formato seguem o pipe já existente | erros bloqueantes `CONSENTIMENTO_OBRIGATORIO`, `CAPTCHA_NAO_CONFIGURADO`, `LIMITE_PUBLICO`, `TOKEN_AUSENTE`, `CONTATO_COMERCIAL_BLOQUEADO`, `VERSAO_AUSENTE`, `CONTATO_AUSENTE`, `PAPEL_INSUFICIENTE`
Idempotência: `idLocal` na captura — reenvio não duplica e não apaga consentimento já gravado. O QR pode ser usado mais de uma vez e cada conclusão cria um contato.
Auditoria gerada por: interceptor e plugin de save. Os dois gravam o HMAC, não o nome.
Campos de autoria rejeitados no DTO: sim
Casos de borda cobertos: captura só com nome e pendente; autocadastro com caixa falsa não grava; quarta tentativa pública do mesmo IP; revogação bloqueia contato comercial; eliminação não reescreve a linha anterior e o update da trilha falha
Ação necessária antes de seguir: login de produção continua escalonado. O canal público de revogação do titular está em `[A PREENCHER]`.

## Parecer SEC-07 — T-02

Dado/ação envolvida: prova de consentimento, revogação, eliminação e leitura do termo
Sensibilidade: alta
Papéis com acesso e justificativa (menor privilégio): o titular marca a caixa; o vendedor só registra na própria carteira; gestor e admin revogam e eliminam porque o canal do titular não foi definido; a rota pública não exige sessão
Criptografia em repouso aplicada: sim — AES-256-GCM no CPF/CNPJ, como já estava. O hash do texto do termo é SHA-256 do texto exibido, não um segredo.
Base legal registrada e não vazia: sim. O enriquecimento permanece `legitimo_interesse`. O contato comercial só vira `concedido` com caixa marcada. Planilha e captura nascem `pendente`.
Log de acesso gerado: não se aplica — não há listagem nova nem exportação
Step-up exigido: não nestas rotas. A exportação, que exigiria step-up, não existe.
Nova superfície de ataque introduzida: o autocadastro público. Há teto de 10 pedidos por minuto por IP e, a partir do quarto, `CAPTCHA_NAO_CONFIGURADO` sem gravar. O provedor de captcha não foi nomeado.
Veto exercido: não. A caixa de envio ao ERP não é coletada enquanto a D7 estiver aberta.

## Parecer INT-06 — T-03

Integração: BrasilAPI, ReceitaWS, ViaCEP, Google Sheets e webhook de saída — entrada e saída
Fonte e contrato: os contratos anteriores. O corpo do webhook continua `versaoContrato: v1`, sem nome, e-mail ou telefone.
Comportamento em indisponibilidade: a fonte oficial que falha não bloqueia a captura. Sem consentimento de `envio_erp` a entrega fica `sem_consentimento` e a promoção segue.
Idempotência: hash da linha da planilha; chave `contatoId:versao` no webhook
Payload cru preservado: não para QSA, e-mail e telefone devolvidos pela base. O que fica guardado é razão social, nome fantasia, endereço, CEP e os campos cadastrais sem nome de pessoa (porte e situação), para o MEI continuar identificável como dado pessoal na eliminação.
Credenciais fora do repositório: sim
Log de exportação gerado: não se aplica — a exportação não foi implementada
Sobrescreve dado digitado por humano: não
Ação necessária antes de seguir: a D7. Até lá o webhook não entrega ninguém, mesmo com URL e segredo preenchidos, se o contato não tiver consentimento `envio_erp`.

## Parecer UI-04 — T-04

Telas/componentes criados: faixa de consentimento na captura, `/contatos/:idLocal/termo`, `/p/:token`, `/meu-qr` com QR gerado no aparelho
Toques até o caso mínimo de captura: 2 (Digitar e o nome). A faixa não pede campo.
Campo obrigatório introduzido: não na captura. No autocadastro o botão "Concluir cadastro" só habilita com a caixa, e a frase de destaque fica no topo.
Estado de sincronização visível e honesto: sim. Pendente, concedido, revogado ou escolha ainda só no aparelho. A palavra solta "Salvo" não entra nessa faixa.
Acessibilidade: contraste ok · alvo ≥48px ok · cor+texto ok
Ação crítica com confirmação e resumo: concluir mostra o texto e a caixa antes do botão. Eliminação e revogação não têm tela própria; ficam na API, com gestor ou admin.
Testado em 360px: sim — Playwright `e2e/termo.spec.ts`, destaque dentro dos 800px de altura, botão desabilitado e conclusão depois da caixa
Ação necessária antes de seguir: validação de UX humana. A tela mostra a minuta inclusive os trechos `[DECISÃO]`, porque o texto não foi reescrito.

## Parecer QA-09 — T-05

Categorias aplicadas: 1 funcional (termo, caixa, revogação, eliminação, webhook sem consentimento, QSA ausente). 2 captura sem trava (só o nome continua 201 e pendente; Playwright não desabilita o caminho de digitar). 3 integridade (trilha sem nome em claro; update da auditoria rejeitado; linha anterior igual depois da eliminação). 4 offline (avião, aba morta e fila presa seguem verdes; a escolha sem `id` de servidor fica no aparelho com o horário local). 5 concorrência (as suítes anteriores de versão seguem verdes). 6 acesso (vendedor não elimina; quarta tentativa pública não grava; `GET /v1/exportacoes` segue 404). 7 dedup (matriz/filial, fusão e recuperação seguem verdes; o nome na trilha da fusão é HMAC).
Testes escritos: `apps/api/src/lgpd/termo.spec.ts` (5), ajustes em f0, HTTP, dedup, cifra, retenção, enriquecimento, planilha e webhook; `apps/web/src/features/captura/TelaTermo.test.tsx` (1); `e2e/termo.spec.ts` (1). Bateria: Jest 18/93, Vitest 7/15, Playwright 7.
Falhas encontradas: nenhuma nesta bateria.
Falha silenciosa identificada (a mais perigosa): sim — o risco era gravar a planilha ou o QR como se houvesse consentimento, ou deixar o nome na trilha depois da eliminação. Os testes recusam os três.
Cenários críticos cobertos nominalmente: captura pendente, autocadastro sem caixa, prova com versão `[A PREENCHER, D1]`, captcha ausente, revogação, eliminação sem violar a trilha, QSA fora do payload, webhook sem `envio_erp`.
Pronto para o portão REV-11: sim

### Parecer Dev 1 — Correção funcional
- Aprovado com ressalvas
- Achados: a captura salva pendente; o autocadastro só conclui com a caixa; a revogação bloqueia o contato comercial; a eliminação apaga o dado do cadastro e conserva a trilha. O webhook não chama a rede sem consentimento de ERP. O destaque e o botão foram exercitados em 360px.
- Ação necessária antes de produção: advogado, UX, e os colchetes da minuta. Sem isso o texto não sai para titular externo.

### Parecer Dev 2 — Integridade de dado e auditoria
- Aprovado com ressalvas
- Achados: a trilha nova não contém nome, e-mail nem telefone em claro. A linha anterior à eliminação permanece igual. `updateOne` na auditoria continua lançando `AuditoriaImutavel`. O prazo `AUDITORIA_PRAZO_GUARDA_DIAS` não tem padrão e, com ou sem valor, a rotina não apaga linha. O índice parcial de documento não mudou. A captura continua sem campo obrigatório.
- Ação necessária antes de produção: o dono define o prazo (D9). A rotina não deve passar a apagar a trilha.

### Parecer Dev 3 — Segurança e escala
- Aprovado com ressalvas
- Achados: papéis deny-by-default seguem. CPF/CNPJ continuam cifrados. O autocadastro é superfície nova, com teto por IP e bloqueio nomeado na quarta tentativa. QSA não é persistido. A varredura de segredos ficou limpa. Não há exportação.
- Ação necessária antes de produção: provedor de captcha, sessão real, papel do ERP (D7) e o restante da lista do dono abaixo.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? sim — a eliminação acrescenta linha nova pseudonimizada e não altera a anterior.
2. Captura sem campo obrigatório? sim — o rascunho salva com pendente visível. A caixa obrigatória é só a conclusão do autocadastro (ADR-008).
3. Responsável identificado em toda ação? sim — `responsavelId` é o ObjectId de quem emitiu o QR ou de quem registrou a caixa. Não é nome.
4. Estado de sincronização honesto? sim — pendente, concedido, revogado ou escolha ainda só no aparelho.
5. Carga cognitiva reduzida? sim — a frase fica no topo e o botão nasce desabilitado. A validação de UX humana continua pendente porque a minuta ainda traz notas de decisão.
6. Quebra fluxo existente? não — avião, fusão, promoção e dedup seguiram verdes. O que mudou na trilha foi o valor em claro para HMAC, de propósito.

VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado]
Pendências antes de produção: lista abaixo. O texto não vai para uso externo neste estado.
Observação: este portão prepara o material de revisão e não substitui revisão humana quando exigida pelo processo da empresa.

## BOARD

BACKLOG 1 (F3-02, D8). EM CURSO 0. EM REVISÃO 0. FEITO 31.

## ADRs deste ciclo

ADR-008, aceita em 2026-09-26. A captura mínima e o consentimento do titular convivem: o lead salva pendente; contato comercial, ERP e exportação esperam o registro daquela finalidade.

## Escalonamentos abertos

- Minuta v2 sem uso externo (advogado e UX).
- D7 papel do fornecedor do ERP.
- D8 exportação (F3-02).
- D11 origem dos leads de planilha. O comportamento pendente já está no código; a decisão jurídica não.
- D1, D2, D5, D9, D12 e os canais sem número.
- Provedor de captcha.
- Campo `conflito` (desde 2026-09-25).
- Login para o step-up valer em produção (desde 2026-09-26).

## Dívida consciente

- O enriquecimento ainda emite um `WARN tentativa_autoria_cliente` em `alteradoEm`.
- A deduplicação carrega os contatos não descartados na memória.
- A origem da auditoria do plugin continua `api`.
- Não há tela de revogação nem de eliminação. As duas existem na API para gestor ou admin.
- A caixa de ERP aparece no texto da minuta e não é um controle que grava consentimento.
- `shadcn` não foi instalado. A tela usa o Tailwind já aceito.

## Como verificar você mesmo

```bash
pnpm lint
pnpm build
pnpm test
bash infra/ci/varrer-segredos.sh
pnpm test:e2e
```

Nesta máquina, em 2026-09-26: lint e build verdes; Jest 18 suítes e 93 testes; Vitest 7 arquivos e 15 testes; varredura `limpa`; Playwright 7 testes, incluindo avião, aba morta, fila presa, fusão, promoção, termo e 360px.

## O que não foi verificado

- GitHub Actions e proteção de branch.
- `docker compose up` em máquina limpa. Neste host o socket do Docker negou permissão. Não é defeito do arquivo Compose e não foi reexecutado como sucesso.
- Login real de produção.
- Câmera física.
- BrasilAPI, ReceitaWS, ViaCEP e Google Sheets ao vivo.
- Upload offsite do backup, cron, e RTO/RPO de volume de produção.
- Receptor real de webhook. Com a D7 aberta, mesmo um receptor configurado não recebe contato sem consentimento `envio_erp`.
- Revisão de advogado e validação de UX da minuta.

## O que ainda depende do dono

1. Revisão de advogado humano e validação de UX antes de qualquer uso externo da minuta.
2. D1: razão social, CNPJ, endereço, versão oficial e data do termo.
3. D2: nome e contato do encarregado.
4. D5: canais de contato comercial (e-mail, telefone, WhatsApp).
5. D7: o fornecedor do ERP é operador ou controlador separado. Enquanto estiver aberto, o webhook não envia ninguém.
6. D8: finalidade da exportação. O card F3-02 continua bloqueado. Não há CSV, XLSX nem JSON.
7. D9: prazos de guarda, inclusive o da trilha. `AUDITORIA_PRAZO_GUARDA_DIAS` não tem padrão e a rotina não apaga linha.
8. D11: origem dos contatos da planilha e como o titular é informado. Eles entram pendentes e bloqueados. Não são marcados como consentidos.
9. D12: provedor de hospedagem e transferência internacional.
10. Colchetes sem número: canal de revogação, proteção do registro offline no aparelho, confirmação do papel da Google no Sheets, nome do fornecedor do ERP.
11. Provedor de captcha do autocadastro. Do quarto pedido por IP a API responde `CAPTCHA_NAO_CONFIGURADO`.
12. Campo `conflito` no schema, ainda sem decisão.
13. Sessão de produção para o step-up TOTP. Sem ela a promoção a cliente em `NODE_ENV=production` continua inacessível.
14. Credenciais da planilha, se a ingestão for ligada: id, token OAuth `spreadsheets.readonly` e ObjectId do responsável.
15. URL e segredo do webhook, se um dia a D7 permitir o envio.
16. Bucket, chave e cron do backup. A regra 3-2-1 segue sem segunda mídia e sem cópia fora do site.
17. `CIFRA_CHAVE_BASE64` e `CIFRA_PEPPER` gerados fora do repositório.

## Parada

Não há fase seguinte neste pedido. Os PRs 1 a 4 não foram alterados e não houve merge.
