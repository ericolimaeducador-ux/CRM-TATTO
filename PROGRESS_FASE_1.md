# PROGRESS — Fase 1 · Captura

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 1."

**Objetivo.** Capturar um lead no aparelho, com ou sem rede, e fazê-lo chegar ao servidor uma única vez.

**Regra de saída da fase.** Nenhum card da Fase 2 abre antes do veredito do REV-11 neste arquivo.

## Cards

| Card | Agente | Status | Observação |
|---|---|---|---|
| F1-01 API de contatos | API-03 | em revisão | idempotência, score e auditoria HTTP verdes |
| F1-02 Fila offline | SCAN-05 | em revisão | grava local antes da rede; profundidade sobe no lote |
| F1-03 Leitura de QR | SCAN-05 | em revisão | parser não descarta leitura; câmera tem saída manual |
| F1-04 Tela de captura | UI-04 | em revisão | um toque até o nome; autosave de 800 ms |
| F1-05 Indicador de sincronização | UI-04 + SCAN-05 | em revisão | três textos distintos; preso exporta JSON |
| F1-06 Testes 1–6 | QA-09 | em revisão | suíte escrita; o resultado da execução entra neste parecer antes do portão |
| F1-07 Portão | REV-11 | ⬜ não iniciado | |

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

Categorias aplicadas: 1 funcional (criar, listar, indicador, toque em 360px); 2 captura sem trava (nome só, CPF malformado e dois rascunhos com o mesmo CPF já estão em `contatos.http.spec.ts`; o parser não descarta leitura); 3 integridade (auditoria de não-rascunho já coberta no F1-01; esta suíte nega DELETE HTTP e PATCH na trilha); 4 offline (avião com fechar e reabrir, `idLocal` três vezes, aba morta no meio do autosave, item preso com alerta); 5 concorrência (duas edições da mesma versão já no F1-01; dois vendedores no mesmo CPF ao mesmo tempo; promoção a qualificado duas vezes); 6 acesso (carteira alheia e auditor já no F1-01; rota sem decorator no F0-03; cliente sem step-up; `GET /v1/exportacoes` responde 404). Exclusão da exportação de base: o card F3-02 ainda não existe, então não há o que step-up proteger além da promoção a cliente. Exclusão da categoria 7: dedup e merge são o F2-03; esta fase não funde contato
Testes escritos: `apps/api/test/f1-captura.spec.ts` (5); `apps/web/src/lib/qr/parsear.test.ts` (4); `apps/web/src/lib/offline/atraso.test.ts` (2); `apps/web/src/features/captura/IndicadorSincronizacao.test.tsx` (5 estados); `e2e/aviao.spec.ts`, `e2e/aba-morta.spec.ts`, `e2e/fila-presa.spec.ts`, `e2e/toque.spec.ts` (1 cada). A execução ainda não está registrada aqui
Falhas encontradas: o debounce de 800 ms descartava o nome se a aba morresse ou a rota interna trocasse antes do timer; o service worker não assumia a página, então reabrir offline não tinha shell; o perdedor de `CONFLITO_VERSAO` gravaria uma segunda linha de auditoria da mudança que não foi dele. Correções fora do glob do QA-09, com teste antes: `FormularioCaptura.tsx`, `apps/web/public/sw.js`, `autoria.interceptor.ts`. O workflow em `.github/workflows/ci.yml` também passou a chamar `pnpm test:e2e` — arquivo do OPS-10, necessário para a suíte não existir só na máquina de quem desenvolve
Falha silenciosa identificada (a mais perigosa): sim — a aba fechada no meio do autosave perdia o nome sem erro, e o indicador podia seguir em "Salvo neste aparelho" num aparelho que já não tinha o texto. O `pagehide` grava o rascunho e a reabertura devolve o nome. O indicador não usa a palavra "Salvo" sozinha
Cenários críticos cobertos nominalmente: avião → fechar → reabrir → reconectar sem duplicata; triplo `idLocal`; aba morta; item preso visível; duas edições; dois capturando o mesmo CPF; promoção duplicada com uma auditoria; cliente sem TOTP; 360px com alvo de 48px. A câmera física continua fora. A categoria 7 continua fora
Pronto para o portão REV-11: não — a execução de lint, build, Jest, Vitest e Playwright ainda vai ser registrada neste parecer

## Veredito do Portão

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
