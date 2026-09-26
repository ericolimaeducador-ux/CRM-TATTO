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
| F2-04 QR próprio + autocadastro | UI-04 + SEC-07 | bloqueado | termo jurídico aberto; sem implementação |
| F2-05 Testes 1–7 | QA-09 | ⬜ não iniciado | |
| F2-06 Portão | REV-11 | ⬜ não iniciado | |

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

## Veredito do Portão

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
