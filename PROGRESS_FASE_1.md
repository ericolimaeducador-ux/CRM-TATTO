# PROGRESS — Fase 1 · Captura

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 1."

**Objetivo.** Capturar um lead no aparelho, com ou sem rede, e fazê-lo chegar ao servidor uma única vez.

**Regra de saída da fase.** Nenhum card da Fase 2 abre antes do veredito do REV-11 neste arquivo.

## Cards

| Card | Agente | Status | Observação |
|---|---|---|---|
| F1-01 API de contatos | API-03 | feito | idempotência, score e auditoria HTTP verdes |
| F1-02 Fila offline | SCAN-05 | feito | grava local antes da rede; profundidade sobe no lote |
| F1-03 Leitura de QR | SCAN-05 | feito | parser não descarta leitura; câmera física não exercitada |
| F1-04 Tela de captura | UI-04 | feito | um toque até o nome; autosave de 800 ms |
| F1-05 Indicador de sincronização | UI-04 + SCAN-05 | feito | três textos distintos; preso exporta JSON |
| F1-06 Testes 1–6 | QA-09 | feito | Jest 64, Vitest 12 e Playwright 4 verdes neste host |
| F1-07 Portão | REV-11 | feito | APROVADO COM RESSALVAS |

## Parecer API-03 — F1-01

Rotas criadas/alteradas: `POST /v1/contatos` (vendedor, gestor, admin); `PATCH /v1/contatos/:id` (quem edita a própria carteira, ou gestor/admin); `GET /v1/contatos` e `GET /v1/contatos/:id` (leitura; vendedor só na própria carteira); `GET /v1/contatos/:id/auditoria` (gestor, admin, auditor); `POST /v1/contatos/:id/transicao` (edição, com gestão e step-up nas passagens que a matriz exige); `POST /v1/contatos/lote` (criação, até 100, sucesso parcial)
Validação: avisos `CPF_INVALIDO`, `CNPJ_INVALIDO`, `EMAIL_INVALIDO`, `TELEFONE_INVALIDO`, `CEP_INVALIDO`, `FORMATO_INVALIDO`, `TIPO_INVALIDO`, `MODO_INVALIDO`, `CAMPO_AUSENTE`, `CAMPO_IGNORADO` | erros bloqueantes `CPF_DUPLICADO`, `CNPJ_DUPLICADO`, `TRANSICAO_INVALIDA`, `CAMPOS_OBRIGATORIOS_TRANSICAO`, `CONFLITO_VERSAO`, `LIMITE_LOTE_EXCEDIDO`, `CONTATO_REVOGADO`, `STEP_UP_NECESSARIO`, `PAPEL_INSUFICIENTE`
Idempotência: `idLocal` — reenvio devolve 200 com o documento existente, inclusive quando dois POST chegam juntos
Auditoria gerada por: interceptor. O serviço não chama `insertMany`. O PATCH usa `updateOne` condicional pela `versao`, então o plugin do schema (caminho do `save`) não escreve essa trilha; o interceptor faz o diff. A criação continua no `save`, com `autorId` injetado pelo interceptor na sessão e aplicado em `$locals` para o plugin não inventar autor
Campos de autoria rejeitados no DTO: sim — `criadoPor`, `criadoEm`, `alteradoPor` e `alteradoEm` são apagados do corpo e logados como `tentativa_autoria_cliente`
Casos de borda cobertos: nome só; score ≥ 25 persiste `capturado`; dois rascunhos com o mesmo CPF; CPF malformado; duplo POST; duas edições da mesma versão; lote acima de 100; profundidade da fila no lote; vendedor fora da carteira; auditor sem escrita
Ação necessária antes de seguir: o schema não tem `conflito`. As duas versões ficam no aparelho e o servidor não sobrescreve. Registro em `.grok/ESCALONAMENTOS.md`. Login real ainda não existe: fora de `NODE_ENV=production` a sessão de teste vem de headers. Em produção esses headers são ignorados

## Parecer SCAN-05 — F1-02

Mecanismo de leitura: não neste card — a câmera entra no F1-03. Verificado: não se aplica
Formatos de QR parseados: nenhum neste card
Comportamento com payload irreconhecível: o campo `payloadBruto` já cabe no contato local; o parser chega no próximo card
Persistência local antes da rede: sim — `gravarContato` e a operação acontecem antes de `drenar` chamar `fetch`
Idempotência da fila: `idLocal` — o POST repete o mesmo identificador; o teste triplo de reenvio HTTP fica no F1-06. Testada com reenvio triplo: não, ainda
Estratégia de conflito: o servidor responde `CONFLITO_VERSAO` e não grava por cima; o aparelho guarda valor local e documento do servidor e espera escolha humana (`resolverConflito`)
Alerta de item preso na fila: sim — após 10 tentativas o estado vira `preso`. A frase e o botão de exportar JSON aparecem na tela do F1-05. O worker continua tentando, sem limite
Ação necessária antes de seguir: o service worker `captura7-sw-1` não cacheia `/v1/` nem método diferente de GET. A câmera ainda não lê

## Parecer SCAN-05 — F1-03

Mecanismo de leitura: nativo + fallback + manual — verificado: o código escolhe `BarcodeDetector` quando existe e, sem ele, carrega `@zxing/browser`. O botão "Digitar em vez disso" fica na mesma tela. Host sem TLS mostra o motivo, não um erro genérico de permissão. A câmera física não foi exercitada neste ambiente
Formatos de QR parseados: vCard 2.1/3.0, MeCard, URL, mailto, tel e texto livre
Comportamento com payload irreconhecível: string vazia devolve `reconhecido: false` e `payloadBruto` intacto, sem nome. Texto que não casa com os formatos vira texto livre em observações, também com `payloadBruto`
Persistência local antes da rede: sim — quem grava é a fila do F1-02; este card só entrega a leitura
Idempotência da fila: `idLocal` — testada com reenvio triplo: não neste card
Estratégia de conflito: a do F1-02, sem mudança
Alerta de item preso na fila: sim — após 10 tentativas, estado `preso`, tela no F1-05
Ação necessária antes de seguir: a tela que abre o formulário a partir da leitura entra no F1-04

## Parecer UI-04 — F1-04

Telas/componentes criados: `/capturar` com Ler QR, Digitar e Meu QR; `/capturar/qr`; `/contatos/:idLocal` com cartões Contato, Documento, Endereço e Observações; `/meu-qr` só avisa que o termo jurídico não foi redigido
Toques até o caso mínimo de captura: 1 — o botão Digitar abre o formulário com o nome em foco; digitar não é toque. O segundo toque do orçamento não é necessário
Campo obrigatório introduzido: não
Estado de sincronização visível e honesto: sim — no formulário, com os textos `Salvo neste aparelho`, `Enviando…` e `Sincronizado`. A lista e a fila entram no F1-05
Acessibilidade: contraste ok — texto stone-900 sobre fundo claro e botão branco sobre stone-900 · alvo ≥48px ok — `min-h-12` · cor+texto ok — o estado leva ícone textual e frase
Ação crítica com confirmação e resumo: nenhuma nesta tela. Descarte, fusão, promoção e exportação de base não estão no caminho de captura
Testado em 360px: não nesta execução — a coluna usa largura total e o Playwright do F1-06 abre em 360px
Ação necessária antes de seguir: o indicador na lista e o alerta de item preso ficam no F1-05

## Parecer UI-04 — F1-05

Telas/componentes criados: barra no topo, badge em cada item de `/contatos`, página `/fila` com exportação e escolha de conflito
Toques até o caso mínimo de captura: 1, igual ao F1-04
Campo obrigatório introduzido: não
Estado de sincronização visível e honesto: sim — os textos são `Salvo neste aparelho`, `Enviando…`, `Sincronizado`, e ainda `Preso na fila` e `Conflito: escolha o valor`. Nenhum deles é um "Salvo" genérico
Acessibilidade: contraste ok · alvo ≥48px ok · cor+texto ok — cada estado tem rótulo e palavra, não só cor
Ação crítica com confirmação e resumo: a escolha de conflito descreve o campo, o valor do aparelho e o do servidor antes dos dois botões. A exportação JSON não apaga o registro
Testado em 360px: não nesta execução — o Playwright do F1-06 abre em 360px
Ação necessária antes de seguir: provar no Playwright o ciclo avião → reabrir → sincronizar sem duplicata

## Parecer SCAN-05 — F1-05

Mecanismo de leitura: o do F1-03 — verificado: sem mudança
Formatos de QR parseados: os do F1-03
Comportamento com payload irreconhecível: o do F1-03
Persistência local antes da rede: sim
Idempotência da fila: `idLocal` — testada com reenvio triplo: não, fica no F1-06
Estratégia de conflito: a fila marca `conflito` e a tela pede escolha; nenhum dos botões funde dois contatos
Alerta de item preso na fila: sim — após 10 tentativas, texto "Este registro está preso na fila" e botão "Exportar este registro como JSON"
Ação necessária antes de seguir: o reenvio triplo e o avião ainda precisam da suíte do QA-09

## Parecer QA-09 — F1-06

Categorias aplicadas: 1 funcional (criar, listar, indicador, toque em 360px); 2 captura sem trava (nome só, CPF malformado e dois rascunhos com o mesmo CPF em `contatos.http.spec.ts`; o parser não descarta leitura); 3 integridade (auditoria de não-rascunho no F1-01; esta suíte nega DELETE HTTP e PATCH na trilha); 4 offline (avião com fechar e reabrir, `idLocal` três vezes, aba morta no meio do autosave, item preso com alerta); 5 concorrência (duas edições da mesma versão no F1-01; dois vendedores no mesmo CPF ao mesmo tempo; promoção a qualificado duas vezes); 6 acesso (carteira alheia e auditor no F1-01; rota sem decorator no F0-03; cliente sem step-up; `GET /v1/exportacoes` responde 404). Exclusão da exportação de base: o card F3-02 ainda não existe, então o step-up exercitado é o da promoção a cliente. Exclusão da categoria 7: dedup e merge são o F2-03; esta fase não funde contato
Testes escritos: `apps/api/test/f1-captura.spec.ts` (5); `apps/web/src/lib/qr/parsear.test.ts` (4); `apps/web/src/lib/offline/atraso.test.ts` (2); `apps/web/src/features/captura/IndicadorSincronizacao.test.tsx` (5 estados); `e2e/aviao.spec.ts`, `e2e/aba-morta.spec.ts`, `e2e/fila-presa.spec.ts`, `e2e/toque.spec.ts` (1 cada)
Falhas encontradas: o debounce de 800 ms descartava o nome se a aba morresse ou a rota interna trocasse antes do timer; o service worker não assumia a página, então reabrir offline não tinha shell; o perdedor de `CONFLITO_VERSAO` gravaria uma segunda linha de auditoria. Correções fora do glob do QA-09, com o teste escrito antes: `FormularioCaptura.tsx`, `apps/web/public/sw.js`, `autoria.interceptor.ts`. A primeira execução do Jest viu dois POST paralelos do mesmo `idLocal` responderem 201 porque o índice único ainda não existia; os dois harnesses passaram a esperar `createIndexes` e a repetição ficou 201 e 200, com um documento. O POST de transição responde 201, que é o padrão do Nest. O workflow `.github/workflows/ci.yml` passou a chamar `pnpm test:e2e` (arquivo do OPS-10). A varredura de segredos deixava de sair 0 porque `mongodb://127.0.0.1:27017/...` na mesma linha que `@captura7` casava o padrão de senha; o padrão agora exige usuário e senha sem barra
Falha silenciosa identificada (a mais perigosa): sim — a aba fechada no meio do autosave perdia o nome sem erro. O `pagehide` grava o rascunho e a reabertura devolve o nome. O indicador não usa a palavra "Salvo" sozinha
Cenários críticos cobertos nominalmente, executados neste host em 2026-09-25: `pnpm lint` verde; `pnpm test` com 64 testes Jest e 12 Vitest verdes; `pnpm test:e2e` com 4 testes Playwright verdes no Chromium, viewport 360×800, incluindo avião → fechar → reabrir → reconectar com um único "Lead Avião" no servidor. A câmera física não foi aberta. O GitHub Actions não rodou daqui. A categoria 7 continua fora
Pronto para o portão REV-11: sim

## Veredito do Portão

### Parecer Dev 1 — Correção funcional
- Aprovado com ressalvas
- Achados: o caminho Digitar grava o nome, o parser cobre vCard, MeCard, URL, mailto, tel e texto livre, e o Playwright deste host fechou o ciclo avião → fechar a aba → reabrir offline → reconectar com um único lead no servidor. A aba morta no meio do autosave devolve o nome. O item preso mostra a frase e o botão de JSON. O POST de transição responde 201.
- Ação necessária antes de produção: abrir a câmera num aparelho de verdade. Este ambiente não exercitou BarcodeDetector nem ZXing contra um QR físico.

### Parecer Dev 2 — Integridade de dado e auditoria
- Aprovado com ressalvas
- Achados: `idLocal` repetido três vezes e em paralelo fica um contato. Duas edições da mesma versão deixam uma escrita e um `CONFLITO_VERSAO`. A promoção a qualificado disparada duas vezes audita uma linha de status. Dois vendedores com o mesmo CPF não são fundidos: um fica `capturado` e o outro `rascunho` com `CPF_DUPLICADO`. DELETE HTTP e PATCH na trilha respondem 404. Os índices parciais da fase 0 não foram alterados. O campo `conflito` continua fora do schema; as duas versões ficam no aparelho.
- Ação necessária antes de produção: decidir o escalonamento do campo `conflito` (ARQ-02). Sem isso o servidor não guarda a segunda versão.

### Parecer Dev 3 — Segurança e escala
- Aprovado com ressalvas
- Achados: autoria do cliente é descartada e o autor da trilha é o da sessão. Fora de produção a sessão de teste vem de headers; em `NODE_ENV=production` esses headers são ignorados e a escrita sem sessão é recusada. CPF malformado não volta em claro. Cliente sem step-up recebe `STEP_UP_NECESSARIO` e permanece qualificado. Não há rota de exportação de base. O lote acima de 100 é recusado. A varredura de segredos saiu limpa depois de o padrão deixar de tratar o host local como senha. Não houve teste de volume.
- Ação necessária antes de produção: login real no lugar dos headers de teste, e TOTP de verdade no step-up. O header `x-step-up-teste` não é um segundo fator.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? sim — alteração fora de rascunho grava autor, instante e valor anterior/novo; a trilha não tem rota de alteração
2. Captura sem campo obrigatório? sim — o formulário salva com um campo e não desabilita gravação
3. Responsável identificado em toda ação? sim — sem sessão a escrita é recusada; o autor gravado é o da sessão, e o corpo do cliente é descartado
4. Estado de sincronização honesto? sim — os textos são `Salvo neste aparelho`, `Enviando…`, `Sincronizado`, `Preso na fila` e `Conflito: escolha o valor`. O teste de avião viu o primeiro enquanto a rede estava cortada e só o terceiro depois da resposta do servidor
5. Carga cognitiva reduzida? sim — três caminhos na entrada, cartões fechados, e o conflito pede uma escolha com os dois valores escritos
6. Quebra fluxo existente? não — a fase 0 permanece e a captura acrescenta rotas; dedup e merge não foram abertos

```
VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado]
Pendências antes de produção:
- Login real. Os headers de teste não valem com NODE_ENV=production.
- TOTP real no step-up de cliente. O header de teste não substitui o código.
- Decisão do Erico sobre o campo conflito no schema.
- Câmera física.
- GitHub Actions desta fase ainda não executado.
- docker compose em máquina limpa continua como na fase 0.
Observação: este portão prepara o material de revisão e não substitui revisão humana
quando exigida pelo processo da empresa.
```

## RELATÓRIO — FASE 1 — 2026-09-25

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 1."

### Executado

| Card | Agente | Status | Arquivos |
|---|---|---|---|
| F1-01 | API-03 | feito | `apps/api/src/contatos/**` (rotas, interceptor, idempotência, score, lote) |
| F1-02 | SCAN-05 | feito | `apps/web/src/lib/offline/**`, `apps/web/public/sw.js` |
| F1-03 | SCAN-05 | feito | `apps/web/src/lib/qr/**`, `apps/web/src/features/captura/LeitorQr.tsx` |
| F1-04 | UI-04 | feito | `apps/web/src/features/captura/TelaCaptura.tsx`, `FormularioCaptura.tsx`, `PaginaQr.tsx`, `MeuQr.tsx` |
| F1-05 | UI-04 + SCAN-05 | feito | `BarraSincronizacao.tsx`, `ListaContatos.tsx`, `PaginaFila.tsx` |
| F1-06 | QA-09 | feito | `apps/api/test/f1-captura.spec.ts`, testes Vitest, `e2e/**` |
| F1-07 | REV-11 | feito | este arquivo |

### Pareceres dos agentes

Os pareceres de API-03, SCAN-05 e UI-04 estão nas seções acima, no formato de cada persona. O que a execução do F1-06 fechou depois deles: reenvio triplo de `idLocal`, avião com reabertura, aba morta e alerta de item preso. O parecer do QA-09 — F1-06, também acima, é o parecer de prontidão.

### Parecer QA-09

Categorias aplicadas: 1, 2, 3, 4, 5 e 6, como no parecer F1-06. Categoria 7 excluída porque dedup e merge são o F2-03.
Testes escritos: 5 Jest novos, 4 de parser, 2 de atraso, 5 estados do indicador, 4 Playwright.
Falhas encontradas: perda do nome antes do debounce; service worker sem assumir a página; auditoria duplicada no `CONFLITO_VERSAO`; corrida de índice no harness. Corrigidas com o teste já escrito.
Falha silenciosa identificada (a mais perigosa): sim — a aba morta no meio do autosave.
Cenários críticos cobertos nominalmente: avião sem duplicata; triplo `idLocal`; aba morta; item preso; duas edições; dois vendedores no mesmo CPF; promoção duplicada com uma auditoria; cliente sem TOTP; alvo de 48px em 360px.
Pronto para o portão REV-11: sim

### Portão REV-11

Dev 1 Aprovado com ressalvas. Dev 2 Aprovado com ressalvas. Dev 3 Aprovado com ressalvas. Conselho: 1 sim, 2 sim, 3 sim, 4 sim, 5 sim, 6 não.

```
VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado]
Pendências antes de produção:
- Login real. Os headers de teste não valem com NODE_ENV=production.
- TOTP real no step-up de cliente.
- Decisão sobre o campo conflito no schema.
- Câmera física.
- GitHub Actions desta fase ainda não executado.
- docker compose em máquina limpa continua como na fase 0.
Observação: este portão prepara o material de revisão e não substitui revisão humana
quando exigida pelo processo da empresa.
```

### Estado

BOARD: BACKLOG 7 · EM CURSO 0 · EM REVISÃO 0 · FEITO 13
ADRs abertos neste ciclo: nenhum. Seguem os da fase 0 (ADR-004, ADR-005, ADR-006, ADR-007).
Escalonamentos abertos: termo de consentimento (SEC-07; bloqueia F2-04 e F3-02, não esta fase); campo `conflito` ausente no schema (API-03).
Dívida técnica assumida conscientemente: sessão de teste por header só quando `NODE_ENV` não é production; escolha de conflito fica no aparelho até o schema ganhar o campo; a câmera tem saída manual e não foi provada num dispositivo; o Compose de máquina limpa não ficou verde na fase 0 e não foi reaberto aqui.

### Como verificar você mesmo

```
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
bash infra/ci/varrer-segredos.sh
```

O que esta sessão viu em 2026-09-25: `pnpm lint` verde; `pnpm test` com 64 Jest e 12 Vitest verdes; `pnpm test:e2e` com 4 Playwright verdes (o de avião inclusive); a varredura de segredos limpa. O build dos dois apps rodou dentro de `pnpm test:e2e`.

### O que ficou sem verificação

- O GitHub Actions não foi disparado daqui. O workflow passou a instalar o Chromium e a rodar `pnpm test:e2e`, e essa corrida não existe ainda.
- Proteção de branch não foi conferida.
- `docker compose up` em máquina limpa continua não verde, pelo mesmo motivo da fase 0: o host precisou de ACCEPT no bridge (iptables-legacy), fora do repositório.
- Backup, RTO, RPO e volume de índice não são desta fase e não foram medidos.
- TOTP real e login real não existem. O step-up provado é o header de teste fora de production.
- A câmera física não foi aberta. O parser foi testado com texto; o fallback ZXing não leu uma imagem de câmera.

### Autorização solicitada

Abrir FASE 2? [aguardando]
