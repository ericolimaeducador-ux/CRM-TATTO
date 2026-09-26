# PROGRESS — Fase 2 · Enriquecimento e ingestão

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 2."

**Objetivo.** Sugerir dado oficial e ingerir planilha sem travar a captura, e deixar a fusão só na mão de uma pessoa.

**Regra de saída da fase.** Nenhum card da Fase 3 abre antes do veredito do REV-11 neste arquivo. O F2-04 permanece bloqueado pelo termo jurídico.

## Cards

| Card | Agente | Status | Observação |
|---|---|---|---|
| F2-01 CNPJ + CEP | INT-06 | feito | parecer abaixo |
| F2-02 Google Sheets | INT-06 | feito | parecer abaixo |
| F2-03 Dedup + merge | DQ-08 + UI-04 | ⬜ não iniciado | |
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

## Veredito do Portão

```
VEREDITO DO PORTÃO: <pendente>
Pareceres: Dev1 [ ] Dev2 [ ] Dev3 [ ] Conselho de Design [ ]
Pendências antes de produção:
```
