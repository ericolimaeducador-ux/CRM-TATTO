# PROGRESS — Fase 2 · Enriquecimento e ingestão

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 2."

**Objetivo.** Sugerir dado oficial e ingerir planilha sem travar a captura, e deixar a fusão só na mão de uma pessoa.

**Regra de saída da fase.** Nenhum card da Fase 3 abre antes do veredito do REV-11 neste arquivo. O F2-04 permanece bloqueado pelo termo jurídico.

## Cards

| Card | Agente | Status | Observação |
|---|---|---|---|
| F2-01 CNPJ + CEP | INT-06 | feito | parecer abaixo |
| F2-02 Google Sheets | INT-06 | feito | parecer abaixo |
| F2-03 Dedup + merge | DQ-08 + UI-04 | feito | pareceres abaixo |
| F2-04 QR próprio + autocadastro | UI-04 + SEC-07 | bloqueado | sem implementação; parecer abaixo |
| F2-05 Testes 1–7 | QA-09 | feito | parecer abaixo |
| F2-06 Portão | REV-11 | feito | APROVADO COM RESSALVAS |

## Parecer INT-06 — F2-01

Integração: BrasilAPI CNPJ (fallback ReceitaWS) e ViaCEP — entrada
Fonte e contrato: BrasilAPI `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}` (https://brasilapi.com.br/docs); ReceitaWS `GET https://www.receitaws.com.br/v1/cnpj/{cnpj}` (https://www.receitaws.com.br/api), tratando `status: ERROR` mesmo com HTTP 200; ViaCEP `GET https://viacep.com.br/ws/{cep}/json/` (https://viacep.com.br/), tratando `{ erro: true }` com HTTP 200.
Comportamento em indisponibilidade: timeout de 3s, circuit breaker após 5 falhas por fonte (60s, depois meia-abertura), falha vira `avisos[]` e o contato continua salvo
Idempotência: cache `cnpj:{digitos}` por 30 dias e `cep:{digitos}` sem expiração, na coleção `enriquecimento_cache`
Payload cru preservado: sim — campo: `origem.enriquecimentoBruto`
Credenciais fora do repositório: sim — estas fontes públicas não pedem chave
Log de exportação gerado: não se aplica
Sobrescreve dado digitado por humano: não
Ação necessária antes de seguir: nenhuma para este card. O CNPJ consultado é cifrado a partir dos dígitos da requisição quando o contato ainda não tem `cnpjHash`. Promoção barrada pelo índice único vira aviso e o status anterior permanece.

## Parecer INT-06 — F2-02

Integração: Google Sheets API v4 — entrada
Fonte e contrato: `GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}` com `Authorization: Bearer` (https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get). Corpo `ValueRange`: `range`, `majorDimension`, `values`.
Comportamento em indisponibilidade: timeout de 3s, circuit breaker da fonte `sheets`, resposta 200 com aviso. Sem credencial também responde 200 com `PLANILHA_NAO_CONFIGURADA` e não chama a rede. O polling de 5 minutos só arma fora de teste e só quando os três valores existem e não são placeholder.
Idempotência: SHA-256 dos pares normalizados da linha, gravado em `planilha_linhas.hash`, e `idLocal` `sheets-{hash}` no `ContatosService.criar`. A releitura percorre a grade inteira de propósito: a marca `planilha_marcas.ultimaLinha` avança, mas não corta linhas, para uma inserção no meio não passar batido.
Payload cru preservado: sim — campo: `origem.payloadBruto` da linha normalizada
Credenciais fora do repositório: sim — `.env.example` só tem placeholder. Exceção de glob: `ContatosModule` exporta `ContatosService` para a ingestão reutilizar `criar` (cifra e idempotência) e `.env.example` ganhou as chaves vazias.
Log de exportação gerado: não se aplica
Sobrescreve dado digitado por humano: não — linha nova cria contato; linha já vista não regrava
Ação necessária antes de seguir: o dono precisa fornecer, fora do repositório, `SHEETS_PLANILHA_ID` (id da planilha de respostas do Forms), `SHEETS_TOKEN` (token OAuth com escopo spreadsheets.readonly; chave de API não lê planilha privada), `SHEETS_RESPONSAVEL_ID` (ObjectId de quem responde pela ingestão automática) e, se a aba não se chamar Respostas, `SHEETS_ABA`. Sem isso a prova de ponta a ponta contra o Google não existe; o teste cobre o contrato com fixture.

## Parecer DQ-08 — F2-03

Regras de normalização aplicadas: as já existentes na escrita; a comparação usa e-mail em minúsculas, telefone E.164 e nome sem acento
Valores não normalizáveis: grava como veio + aviso — este card não cria caminho novo de rejeição
Pesos do score de completude: `PESOS_COMPLETUDE` em `apps/api/src/qualidade/completude.ts` — não alterados
Camadas de dedup ativas e seus limiares: `cpfHash`/`cnpjHash` 1.00 · e-mail 0.95 · telefone E.164 0.90 · Jaro-Winkler ≥ 0.92 e mesma cidade
Falso positivo mais provável identificado: matriz e filial com a mesma raiz e ordem diferente, mesmo que compartilhem e-mail, telefone e cidade — mitigação: viram `relacionados` (`matriz`/`filial`/`grupo`) e nunca `duplicataSuspeita`
Merge automático em algum caminho: não
Precedência de valor respeitada: sim — a sugestão oficial continua só sugestão; aplicar é um PATCH humano
Ação necessária antes de seguir: o escalonamento do campo `conflito` segue aberto e este card não depende dele. A escolha da fusão vai em `valoresEscolhidos`. O schema não mudou. A trilha do plugin grava `origem: api` (valor fixo do plugin); autor, instante, valor anterior e valor novo estão na linha. Recuperação de rascunho usa `motivoDescarte` porque o plugin não audita rascunho.

## Parecer UI-04 — F2-03

Telas/componentes criados: `/duplicatas`, `/merge/:a/:b`, painel Consultar CNPJ/CEP no formulário
Toques até o caso mínimo de captura: 2 (Digitar e o nome) — o painel de consulta não entra nesse caminho
Campo obrigatório introduzido: não
Estado de sincronização visível e honesto: sim — os textos da fase 1 permanecem; a consulta não diz Salvo
Acessibilidade: contraste [ok] · alvo ≥48px [ok] · cor+texto [ok]
Ação crítica com confirmação e resumo: fundir mostra "B será descartado e recuperável por 90 dias" antes do botão, que permanece habilitado
Testado em 360px: sim na suíte Playwright da fase, viewport 360×800; a tela empilha os dois registros abaixo de 640px
Ação necessária antes de seguir: shadcn/ui não foi introduzido. A fase 1 fechou com Tailwind e os mesmos alvos de toque; trazer a biblioteca agora reestilizaria a captura sem mudar a regra. O campo de TOTP avisa que, em produção, o servidor ainda não valida o código de verdade.

## Parecer SEC-07 — F2-04

O card permanece bloqueado. O termo de consentimento segue aberto em `.grok/ESCALONAMENTOS.md` desde 2026-09-25. Não há texto jurídico novo, não há rota pública de autocadastro e não há aceite versionado. A tela Meu QR continua apenas avisando que o termo não foi redigido. O bloqueio também segura o F3-02.

## Parecer UI-04 — F2-04

Telas/componentes criados: nenhum
Toques até o caso mínimo de captura: 2, inalterados
Campo obrigatório introduzido: não
Estado de sincronização visível e honesto: sim
Acessibilidade: contraste [ok] · alvo ≥48px [ok] · cor+texto [ok] — nada novo nesta tela
Ação crítica com confirmação e resumo: não se aplica; a ação não foi construída
Testado em 360px: não se aplica a tela nova
Ação necessária antes de seguir: resposta do dono no escalonamento do termo. Sem isso o card não fecha.

## Parecer QA-09 — F2-05

Categorias aplicadas: 1 funcional, 2 captura sem trava, 3 integridade, 4 offline, 5 concorrência, 6 acesso, 7 dedup e merge. Nenhuma exclusão. O F2-04 não entra na suíte porque não houve implementação.
Testes escritos: `apps/api/src/integracoes/enriquecimento.spec.ts` (7), `apps/api/src/integracoes/sheets.spec.ts` (3), `apps/api/src/qualidade/dedup.spec.ts` (5), `apps/web/src/features/captura/PaginaMerge.test.tsx` (1), `e2e/merge.spec.ts` (1). A suíte anterior continua: Jest 13 arquivos e 79 testes, Vitest 5 arquivos e 13 testes, Playwright 5 testes.
Falhas encontradas: o painel dizia "contato sincronizado" e o Playwright lia isso como o estado `Sincronizado` com o lead ainda só no aparelho; o build de preview não pedia o passo extra e a tela escondia o 403. Os dois foram corrigidos e os testes passaram de novo.
Falha silenciosa identificada (a mais perigosa): [sim — a frase do painel parecia estado de sincronização sem confirmação do servidor. O indicador em si seguia honesto. O texto agora diz que a consulta espera o contato chegar ao servidor.]
Cenários críticos cobertos nominalmente: razão digitada não é sobrescrita; BrasilAPI cai e a ReceitaWS preenche; as duas fontes caem e o nome fica; CNPJ inválido não chama a rede; CEP não cobre logradouro digitado; planilha reprocessada não duplica e uma linha inserida no meio entra; sem credencial a planilha não chama a rede; matriz e filial com o mesmo e-mail não são duplicata; merge sem confirmação e sem step-up não descarta; recuperação dentro de 90 dias e recusa um milissegundo depois; avião, aba morta, fila presa e 360px seguem verdes; a tela de fusão mostra o efeito e só descarta depois do clique.
Pronto para o portão REV-11: sim

## RELATÓRIO — FASE 2 — 2026-09-26

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 2."

### Executado

| Card | Agente | Status | Arquivos |
|---|---|---|---|
| F2-01 CNPJ + CEP | INT-06 | feito | `apps/api/src/integracoes/**` (enriquecimento, cache, circuito) |
| F2-02 Google Sheets | INT-06 | feito | `apps/api/src/integracoes/sheets.*`, `planilha-*`, `.env.example` |
| F2-03 Dedup + merge | DQ-08 + UI-04 | feito | `apps/api/src/qualidade/**`, `apps/web/src/features/captura/PaginaDuplicatas.tsx`, `PaginaMerge.tsx`, `PainelEnriquecimento.tsx` |
| F2-04 QR próprio + autocadastro | UI-04 + SEC-07 | bloqueado | nenhum arquivo de produto; Meu QR segue só com o aviso |
| F2-05 Testes 1–7 | QA-09 | feito | `e2e/merge.spec.ts` e as specs dos cards acima |
| F2-06 Portão | REV-11 | feito | este arquivo |

### Pareceres dos agentes

Os pareceres no formato de cada agente estão nas seções acima: INT-06 (F2-01 e F2-02), DQ-08 e UI-04 (F2-03), SEC-07 e UI-04 (F2-04), QA-09 (F2-05).

### Portão REV-11

### Parecer Dev 1 — Correção funcional
- Aprovado com ressalvas
- Achados: CNPJ vazio é preenchido pela BrasilAPI e, se ela cai, pela ReceitaWS; as duas caindo deixam o contato salvo. CEP não cobre logradouro digitado. A planilha reprocessada não duplica e uma linha no meio entra. Matriz e filial com o mesmo e-mail não viram duplicata. A fusão sem confirmação não escreve, e a tela só descarta depois do clique com o resumo visível. A recuperação dentro de 90 dias devolve o status anterior; um milissegundo depois disso a API recusa e o contato continua descartado.
- Ação necessária antes de produção: provar a planilha contra a conta do dono. O circuito está no código e a falha de timeout está testada; a abertura após a quinta falha não tem um teste contando as cinco chamadas.

### Parecer Dev 2 — Integridade de dado e auditoria
- Aprovado com ressalvas
- Achados: a fusão de um contato já capturado grava valor anterior e valor novo. O plugin continua com `origem: api`. Rascunho fundido não ganha linha de auditoria, porque o plugin ignora rascunho; a recuperação usa o texto de `motivoDescarte`. O campo `conflito` não foi criado. O enriquecimento não sobrescreve valor digitado. Um save de enriquecimento ainda emite `WARN tentativa_autoria_cliente` em `alteradoEm`; o plugin em seguida grava o autor da sessão.
- Ação necessária antes de produção: decidir o escalonamento do campo `conflito`. Se a trilha precisar da origem `merge` ou `enriquecimento`, isso é mudança do plugin e pertence ao ARQ-02.

### Parecer Dev 3 — Segurança e escala
- Aprovado com ressalvas
- Achados: vendedor não enriquece carteira alheia, não dispara a planilha e não vê a fila de duplicatas. Merge e recuperação pedem step-up. O cabeçalho `x-step-up-teste` só vale fora de produção. Não há token nem id de planilha no repositório. A varredura de segredos deste host saiu limpa. A deduplicação carrega os contatos não descartados na memória a cada leitura da fila.
- Ação necessária antes de produção: login e TOTP reais. A fila de duplicatas precisa de paginação antes de a base crescer. Confirmar que `NODE_ENV=production` ignora o cabeçalho de teste num deploy, não só na leitura do middleware.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? [sim] — fusão de não-rascunho grava autor, instante, valor anterior e valor novo; a coleção de auditoria segue sem update.
2. Captura sem campo obrigatório? [sim] — o painel de consulta e a fila de duplicatas não travam o nome.
3. Responsável identificado em toda ação? [sim] — a ingestão automática só arma com `SHEETS_RESPONSAVEL_ID`; o disparo manual usa a sessão; sem credencial não há escrita.
4. Estado de sincronização honesto? [sim] — os textos da fase 1 permanecem. O painel deixou de usar a palavra do estado.
5. Carga cognitiva reduzida? [sim] — a fusão mostra o efeito antes do botão e a matriz não aparece como duplicata.
6. Quebra fluxo existente? [não] — avião, aba morta, fila presa e o toque em 360px passaram de novo.

```
VEREDITO DO PORTÃO: APROVADO COM RESSALVAS
Pareceres: Dev1 [Aprovado com ressalvas] Dev2 [Aprovado com ressalvas] Dev3 [Aprovado com ressalvas] Conselho de Design [aprovado]
Pendências antes de produção:
- Credencial do dono para a planilha: SHEETS_PLANILHA_ID, SHEETS_TOKEN (OAuth spreadsheets.readonly; chave de API não lê planilha privada), SHEETS_RESPONSAVEL_ID e, se a aba não for Respostas, SHEETS_ABA.
- TOTP e login reais. O atalho de teste não é produção.
- Decisão do dono sobre o campo conflito e sobre o texto do termo (F2-04 e F3-02 seguem bloqueados).
- Prova ao vivo de BrasilAPI, ReceitaWS e ViaCEP. Aqui só houve o contrato com mock.
Observação: este portão prepara o material de revisão e não substitui revisão humana
quando exigida pelo processo da empresa.
```

### Estado

BOARD: BACKLOG 4 · EM CURSO 0 · EM REVISÃO 0 · FEITO 18
ADRs abertos neste ciclo: nenhum. ADR-003 segue a regra da planilha. ADR-004, ADR-005, ADR-006 e ADR-007 permanecem como estavam.
Escalonamentos abertos: termo de consentimento (SEC-07, bloqueia F2-04 e F3-02); campo `conflito` ausente no schema (API-03). Nenhum dos dois foi decidido nem fechado.
Dívida técnica assumida conscientemente:
- Cache de enriquecimento é coleção nova em `integracoes`, sem revisão de schema do ARQ-02.
- `ContatosModule` exporta `ContatosService` para a planilha reutilizar `criar`.
- A marca d'água da planilha é gravada e a leitura continua percorrendo a grade inteira, para uma inserção no meio não sumir.
- shadcn/ui não entrou. A tela segue Tailwind, como a fase 1.
- A origem da auditoria continua `api`.
- Docker Compose em máquina limpa segue não verde, pelo mesmo motivo da fase 0.

### Como verificar você mesmo

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
bash infra/ci/varrer-segredos.sh
```

Neste host, em 2026-09-26: `pnpm lint` passou; `pnpm build` passou dentro de `pnpm test:e2e`; `pnpm test` ficou em 13 suítes Jest / 79 testes e 5 arquivos Vitest / 13 testes; `pnpm test:e2e` ficou em 5 testes Playwright, entre eles avião, aba morta, fila presa, 360px e a fusão; a varredura de segredos saiu limpa.

### O que ficou sem verificação

- GitHub Actions e proteção de branch. O workflow existe e não foi disparado daqui.
- `docker compose up` em máquina limpa. Na fase 0 o Compose só subiu depois de uma regra ACCEPT no bridge, fora do repositório.
- Backup, RTO e RPO.
- TOTP real, login de produção e câmera física.
- Volume do índice único e paginação da fila de duplicatas.
- Chamada real à BrasilAPI, à ReceitaWS, ao ViaCEP e à Google Sheets API. Os testes usam fixture do contrato e não saem da rede.
- `NODE_ENV=production` recusando o cabeçalho `x-step-up-teste`. O middleware faz isso; este host não subiu a API em produção.

### Autorização recebida

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 3."
