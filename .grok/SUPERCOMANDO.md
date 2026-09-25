# SUPERCOMANDO — captura7

> **Como usar.** Salve este arquivo em `.grok/SUPERCOMANDO.md` na raiz do repositório.
> No Cursor, em modo **Agent**, cole apenas a linha de disparo (seção 0.1).
> Este documento é a especificação completa. Ele é a fonte de verdade de implementação.
> Onde ele colidir com uma ideia do modelo, **este documento vence**.
> Onde ele colidir com `.cursor/rules/010-integridade.mdc`, **a rule vence**.

---

## 0. Disparo

### 0.1 Linha para colar no Cursor

```
CENTRO DE COMANDOS: leia integralmente .grok/SUPERCOMANDO.md, AGENTS.md,
.cursor/rules/000-projeto.mdc, .cursor/rules/010-integridade.mdc, .grok/BOARD.md
e .grok/DECISOES.md antes de escrever qualquer linha.

Confirme a absorção respondendo, em no máximo 8 linhas: (a) o princípio da entrada
permissiva; (b) os 4 modos de entrada; (c) os 4 papéis de RBAC; (d) em que ponto exato
do sistema existe bloqueio; (e) o que você faz ao encontrar um dilema com a regra 010.

Em seguida execute a FASE 0 conforme a seção 12 do SUPERCOMANDO, do card F0-01 ao F0-06,
na ordem, acionando os agentes indicados. Atualize .grok/BOARD.md e PROGRESS_FASE_0.md
ao fim de cada card. PARE no final da FASE 0 e apresente o relatório da seção 13.
Não abra a FASE 1 sem minha autorização escrita.
```

### 0.2 Regra de comportamento do agente

- Você não é um desenvolvedor genérico. Você é o **CC-00**, e despacha para os agentes de `.grok/agents/`.
- Ao trabalhar como um agente, **adote a persona dele** e produza o parecer no formato declarado no arquivo do agente. Parecer não é enfeite: é o artefato de revisão.
- **Nunca** escreva fora dos globs de `arquivos_que_possui` do agente ativo.
- **Nunca** pule uma parada obrigatória (seção 12) porque "estava indo bem".
- Ao terminar um card, atualize o BOARD **antes** de começar o próximo.
- Se o contexto estiver saturando (você começou a esquecer regras ou a repetir trabalho), **pare e diga isso** em vez de degradar silenciosamente.

---

## 1. Produto

**Nome:** `captura7`
**O que é:** PWA offline-first de captura de leads e clientes, pessoa física e jurídica, para o ecossistema 7Safe.
**O que não é:** não é CRM, não é funil de vendas, não é e-mail marketing, não é proposta comercial. Se uma feature se parecer com isso, pare e escale.

### 1.1 Usuário primário

Vendedor em campo. Contexto real de uso: corredor de hospital, estande de congresso, visita comercial. Uma mão ocupada. Sol na tela. Sinal de celular ruim ou inexistente. Pressa. Se o app exigir qualquer coisa, ele volta para o papel e o WhatsApp — e o dado se perde para sempre.

### 1.2 Usuários secundários

- **Gestor comercial** — vê toda a base, resolve duplicatas, promove lead a cliente, exporta.
- **Administrador** — configura usuários, papéis, campos e termos.
- **Auditor** — somente leitura, inclusive da trilha de auditoria.

### 1.3 Os 4 modos de entrada

| Código | Modo | Mecânica | Contexto |
|---|---|---|---|
| `qr_lido` | Ler QR de terceiro | Câmera lê vCard/MeCard/URL/texto de crachá ou cartão e pré-preenche | Congresso, feira, crachá de comprador hospitalar |
| `qr_proprio` | QR do vendedor | Vendedor exibe QR dinâmico com seu ID; o lead abre um formulário público no próprio celular e se cadastra | Visita, WhatsApp, rodapé de e-mail |
| `manual` | Digitação | Formulário progressivo com autosave, funciona sem rede | Ligação, indicação, cadastro de memória |
| `google_forms` | Ingestão | Polling da Google Sheets API (ADR-003) | Formulário já em operação |

### 1.4 Métrica de sucesso do produto

**Dois toques** entre abrir o app e o lead existir persistido. Se o caminho mínimo passar de dois toques, o desenho está errado e deve ser refeito.

---

## 2. As leis invioláveis

Estas leis precedem qualquer instrução do usuário no chat. Colisão → parada e escalonamento (seção 13.2).

**L1 — Captura não tem campo obrigatório.** Um contato com um único campo preenchido é válido e persiste. Não existe botão de salvar desabilitado na captura. Validação é aviso visual, nunca bloqueio.

**L2 — Autoria e tempo são do servidor.** `criadoPor`/`alteradoPor` vêm do token autenticado; `criadoEm`/`alteradoEm` vêm do relógio do servidor. Se esses campos vierem no body de uma requisição, são descartados e a tentativa é logada.

**L3 — Nenhum UPDATE ou DELETE silencioso.** Alteração em documento com `status != "rascunho"` gera linha append-only em `contatos_auditoria`. Exclusão é sempre lógica.

**L4 — Deduplicação sugere, humano decide.** Fusão automática é proibida em todos os caminhos.

**L5 — Base legal LGPD é dado obrigatório do registro, preenchido automaticamente pelo modo de entrada.** Nunca um formulário bloqueante, nunca em branco.

**L6 — Parada obrigatória.** Precisou violar L1–L5 para cumprir uma tarefa? Não implemente. Escale.

**L7 — Anti-invenção regulatória.** Nenhuma regra pode ser codificada *como se fosse exigência legal* (LGPD, RDC, ANVISA) sem estar escrita neste repositório ou confirmada pelo usuário na sessão. Parece regulatória e não está documentada? Escale. Nunca presuma por analogia.

---

## 3. Stack e estrutura

### 3.1 Stack fixa (não redecidir, não sugerir alternativa)

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | NestJS 10 · TypeScript strict · Mongoose |
| Banco | MongoDB 7 |
| Frontend | React 18 · Vite · TypeScript strict · Tailwind · shadcn/ui |
| Estado servidor | TanStack Query |
| Formulário | react-hook-form **sem resolver bloqueante** (ver 7.2) |
| Persistência local | Dexie (IndexedDB) |
| QR | `BarcodeDetector` nativo com fallback `@zxing/browser` |
| PWA | `vite-plugin-pwa` (Workbox) |
| Testes | Jest (api) · Vitest + Testing Library (web) · Playwright (e2e) |
| Dev | Docker Compose |
| Lint | ESLint + Prettier + husky + lint-staged |

### 3.2 Estrutura de pastas

```
captura7/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── contatos/
│   │   │   │   ├── schemas/         ← território exclusivo do ARQ-02
│   │   │   │   ├── dto/
│   │   │   │   ├── contatos.controller.ts
│   │   │   │   ├── contatos.service.ts
│   │   │   │   └── transicoes.service.ts
│   │   │   ├── auditoria/
│   │   │   ├── auth/                ← SEC-07
│   │   │   ├── seguranca/           ← SEC-07
│   │   │   ├── lgpd/                ← SEC-07
│   │   │   ├── qualidade/           ← DQ-08
│   │   │   ├── normalizacao/        ← DQ-08
│   │   │   ├── integracoes/         ← INT-06
│   │   │   ├── exportacao/          ← INT-06
│   │   │   └── comum/
│   │   ├── migrations/
│   │   └── test/
│   └── web/
│       └── src/
│           ├── features/
│           │   ├── captura/         ← SCAN-05 + UI-04
│           │   ├── contatos/
│           │   ├── merge/
│           │   ├── promocao/
│           │   └── publico/         ← autocadastro via qr_proprio
│           ├── lib/
│           │   ├── offline/         ← SCAN-05
│           │   ├── qr/              ← SCAN-05
│           │   └── api/
│           └── componentes/
├── e2e/
├── infra/
├── .grok/
├── .cursor/rules/
└── docker-compose.yml
```

### 3.3 Convenções

- Identificadores de código em inglês; **termos de domínio em português** (`Contato`, `tipoPessoa`, `razaoSocial`). Traduzir domínio brasileiro gera bug.
- Comentários, docs, mensagens de erro e textos de UI em **pt-BR**.
- Commits Conventional, escopo = ID do agente: `feat(ARQ-02): schema de contatos`.
- Zero `any` sem comentário justificando. Zero `@ts-ignore` sem ADR.
- Nenhum arquivo acima de 300 linhas sem justificativa.

---

## 4. Modelo de dados

### 4.1 Coleção `contatos`

```ts
{
  _id: ObjectId,
  codigo: string,            // "LD-2026-00147", sequencial por ano, gerado no servidor
  idLocal: string,           // UUID v4 gerado no dispositivo — CHAVE DE IDEMPOTÊNCIA

  tipoPessoa: "PF" | "PJ" | "INDEFINIDO",   // default "INDEFINIDO", estado VÁLIDO
  status: "rascunho" | "capturado" | "qualificado" | "cliente" | "descartado",
                                            // default "rascunho"
  motivoDescarte?: string,   // obrigatório somente na transição para "descartado"

  // ─── núcleo comum — TODOS OPCIONAIS NO SCHEMA
  nome?: string,
  nomeSocial?: string,
  emails?: [{ valor: string, tipo?: "pessoal"|"comercial", principal?: boolean }],
  telefones?: [{ e164?: string, bruto: string, tipo?: "celular"|"fixo"|"comercial",
                 whatsapp?: boolean, principal?: boolean }],
  enderecos?: [{ cep?, logradouro?, numero?, complemento?, bairro?, cidade?, uf?,
                 tipo?: "comercial"|"entrega"|"cobranca"|"residencial",
                 principal?: boolean }],
  observacoes?: string,
  tags?: string[],

  // ─── pessoa física
  pf?: {
    cpfCifrado?: string,     // AES-256-GCM (ADR-004)
    cpfHash?: string,        // HMAC-SHA256 com pepper — ESTE é o campo indexado
    cpfMascarado?: string,   // "***.456.789-**" para exibição em lista
    rg?: string,
    dataNascimento?: Date,
    sexo?: "F"|"M"|"outro"|"nao_informado",
    profissao?: string,
    conselho?: { sigla?: "COREN"|"CRM"|"CRF"|"CRO"|"CREFITO"|"outro",
                 numero?: string, uf?: string }
  },

  // ─── pessoa jurídica
  pj?: {
    cnpjCifrado?: string,
    cnpjHash?: string,       // indexado
    cnpjMascarado?: string,
    cnpjRaiz?: string,       // 8 primeiros dígitos — detecção matriz/filial (regra DQ)
    razaoSocial?: string,
    nomeFantasia?: string,
    inscricaoEstadual?: string,
    inscricaoMunicipal?: string,
    cnaePrincipal?: { codigo?: string, descricao?: string },
    cnaesSecundarios?: [{ codigo, descricao }],
    naturezaJuridica?: string,
    porte?: "MEI"|"ME"|"EPP"|"DEMAIS",
    situacaoCadastral?: string,
    dataAbertura?: Date,
    capitalSocial?: number,
    responsavelTecnico?: { nome?, conselho?, numero?, uf? },
    contatos?: [{ nome?, cargo?, email?, telefone?, decisor?: boolean }]
  },

  // ─── proveniência
  origem: {
    modo: "qr_lido"|"qr_proprio"|"manual"|"google_forms"|"importacao",
    capturadoPor?: ObjectId,          // null em qr_proprio e google_forms
    vendedorAtribuido?: ObjectId,     // carteira — define visibilidade do papel vendedor
    dispositivo?: string,
    capturadoEmDispositivo?: Date,    // METADADO INFORMATIVO — nunca fonte de verdade
    geo?: { lat: number, lng: number, precisao: number },
    evento?: string,                  // "Congresso COREN-SP 2026"
    payloadBruto?: string,            // conteúdo do QR, mesmo irreconhecível
    enriquecimentoBruto?: [{ fonte: string, payload: object, em: Date }]
  },

  // ─── qualidade
  completude: { score: number, camposFaltantes: string[], calculadoEm: Date },
  duplicataSuspeita?: [{ contatoId: ObjectId, motivo: string, similaridade: number,
                         detectadoEm: Date, resolvido?: boolean }],
  relacionados?: [{ contatoId: ObjectId, tipo: "matriz"|"filial"|"grupo" }],
  fundidoEm?: ObjectId,               // preenchido no registro absorvido
  avisos?: [{ campo: string, codigo: string, mensagem: string }],

  // ─── LGPD
  lgpd: {
    baseLegal: "consentimento"|"legitimo_interesse"|"execucao_contrato",
    finalidade: string[],
    canalColeta: string,
    consentimentoEm?: Date,
    consentimentoTexto?: string,
    versaoTermo?: string,
    ipConsentimento?: string,
    revogadoEm?: Date,
    purgadoEm?: Date
  },

  // ─── auditoria
  criadoPor?: ObjectId, criadoEm: Date,
  alteradoPor?: ObjectId, alteradoEm: Date,
  versao: number,                     // incrementa a cada alteração
  sincronizadoEm?: Date,
  conflito?: { detectadoEm: Date, versaoLocal: object, versaoServidor: object,
               resolvidoEm?: Date, resolvidoPor?: ObjectId }
}
```

### 4.2 Coleção `contatos_auditoria` — APPEND-ONLY

```ts
{
  _id, contatoId: ObjectId, versao: number,
  campo: string,             // caminho: "pj.razaoSocial"
  valorAnterior: any, valorNovo: any,
  autor: ObjectId, autorNome: string,   // desnormalizado: usuário pode ser removido
  timestampServidor: Date,
  motivo?: string,
  origem: "api"|"sync"|"enriquecimento"|"merge"|"rotina"
}
```

**Sem rota de update. Sem rota de delete. Sem índice que convide sobrescrita.**

### 4.3 Coleções auxiliares

- `usuarios` — `{ nome, email, senhaHash, papel, totpSecretCifrado?, ativo, criadoEm }`
- `acessos_dados` — `{ usuario, acao: "listagem"|"exportacao", filtro, quantidadeRetornada, em }`
- `exportacoes` — `{ usuario, formato, filtro, quantidade, hashArquivo, em }`
- `ingestao_sheets` — `{ planilhaId, ultimaLinha, hashesProcessados[], ultimaExecucao }`
- `contadores` — sequência de `codigo` por ano

### 4.4 Índices — exatamente estes

```js
// PARCIAIS — não-rascunho apenas. Índice único TOTAL aqui quebra L1 = reprovação.
db.contatos.createIndex({ "pf.cpfHash": 1 }, { unique: true,
  partialFilterExpression: { status: { $nin: ["rascunho","descartado"] },
                             "pf.cpfHash": { $exists: true } } })
db.contatos.createIndex({ "pj.cnpjHash": 1 }, { unique: true,
  partialFilterExpression: { status: { $nin: ["rascunho","descartado"] },
                             "pj.cnpjHash": { $exists: true } } })

db.contatos.createIndex({ idLocal: 1 }, { unique: true })   // idempotência da fila
db.contatos.createIndex({ "emails.valor": 1 })
db.contatos.createIndex({ "telefones.e164": 1 })
db.contatos.createIndex({ "pj.cnpjRaiz": 1 })               // matriz/filial
db.contatos.createIndex({ status: 1, criadoEm: -1 })
db.contatos.createIndex({ "origem.vendedorAtribuido": 1, criadoEm: -1 })
db.contatos.createIndex({ codigo: 1 }, { unique: true })
db.contatos.createIndex({ nome: "text", "pj.razaoSocial": "text",
                          "pj.nomeFantasia": "text" },
                        { default_language: "portuguese" })

db.contatos_auditoria.createIndex({ contatoId: 1, timestampServidor: -1 })
db.contatos_auditoria.createIndex({ autor: 1, timestampServidor: -1 })
```

### 4.5 Máquina de estados

```
rascunho ──► capturado ──► qualificado ──► cliente
    │            │              │
    └────────────┴──────────────┴──────► descartado (exige motivoDescarte)
```

| Transição | Exigências |
|---|---|
| `rascunho → capturado` | **Automática** quando `completude.score ≥ 25`. Sem intervenção. |
| `capturado → qualificado` | nome preenchido **E** (CPF válido **ou** CNPJ válido) **E** ao menos um meio de contato. Papel: gestor/admin. |
| `qualificado → cliente` | tudo acima **+** endereço completo **+** step-up TOTP. Papel: gestor/admin. |
| `* → descartado` | `motivoDescarte` obrigatório. Reversível por gestor/admin. |

**Transição bloqueada nunca impede o salvamento do rascunho.** Retorna 422 com código nomeado; o documento permanece e continua editável.

---

## 5. API

### 5.1 Contrato de resposta de escrita

```ts
{ dados: Contato, avisos: [{ campo, codigo, mensagem }], erros: [] }
```

- `avisos` **nunca** impede persistência. Status 200/201.
- `erros` só existe em tentativa de **transição** inválida. Status 422. O rascunho segue salvo.

### 5.2 Rotas

| Método | Caminho | Papéis | Notas |
|---|---|---|---|
| `POST` | `/v1/contatos` | vendedor+ | Idempotente por `idLocal`. Reenvio → 200 com o existente. **Nunca 409, nunca duplica.** |
| `PATCH` | `/v1/contatos/:id` | vendedor(própria)+ | Campo-a-campo. É o autosave. Gera auditoria via interceptor. |
| `GET` | `/v1/contatos` | vendedor(própria)+ | Paginado por cursor. Gera `acessos_dados`. |
| `GET` | `/v1/contatos/:id` | vendedor(própria)+ | Não gera log se for da própria carteira. |
| `GET` | `/v1/contatos/:id/auditoria` | gestor, admin, auditor | Somente leitura. |
| `POST` | `/v1/contatos/:id/transicao` | conforme 4.5 | `{ para, motivo? }`. Valida estritamente. |
| `POST` | `/v1/contatos/:id/merge` | gestor, admin | `{ absorvidoId, valoresEscolhidos }`. Step-up. |
| `GET` | `/v1/contatos/:id/duplicatas` | gestor, admin | Sugestões com score e motivo. |
| `POST` | `/v1/contatos/lote` | vendedor+ | Drenagem da fila offline. Até 100 itens, cada um idempotente. Sucesso parcial com relatório por item. |
| `POST` | `/v1/publico/autocadastro` | **público** | Token do QR no corpo. Rate limit 10/min por IP. Captcha após 3. |
| `GET` | `/v1/publico/termo/:versao` | **público** | Texto do consentimento. |
| `POST` | `/v1/enriquecimento/cnpj` | vendedor+ | Não bloqueante, 3s de timeout. |
| `GET` | `/v1/enriquecimento/cep/:cep` | vendedor+ | Cache permanente. |
| `POST` | `/v1/exportacao` | gestor, admin | Step-up. Gera `exportacoes`. |
| `POST` | `/v1/integracao/contatos-promovidos` | HMAC | Saída para o ERP. Sem consumidor no MVP (ADR-002). |
| `GET` | `/v1/saude` | público | Health check. |

### 5.3 Códigos de erro nomeados

`CPF_DUPLICADO` · `CNPJ_DUPLICADO` · `CPF_INVALIDO` · `CNPJ_INVALIDO` · `TRANSICAO_INVALIDA` · `CAMPOS_OBRIGATORIOS_TRANSICAO` · `STEP_UP_NECESSARIO` · `PAPEL_INSUFICIENTE` · `CONTATO_REVOGADO` · `MERGE_SEM_CONFIRMACAO` · `LIMITE_LOTE_EXCEDIDO`

Nunca vazar exceção do Mongo. Toda mensagem diz **o que fazer**, não só o que falhou.

### 5.4 Implementação obrigatória

- **Interceptor de auditoria** — intercepta toda escrita em `contatos`, faz diff campo a campo, grava em `contatos_auditoria` quando `status != "rascunho"`. Nenhuma chamada manual no serviço.
- **Interceptor de autoria** — injeta `criadoPor`/`alteradoPor`/`criadoEm`/`alteradoEm`. Se vierem no DTO: descarta e loga `WARN tentativa_autoria_cliente`.
- **Guard de papel** — decorator `@Papel(...)`. **Ausência de decorator = negado.** `@Publico()` é o único opt-out.
- **ValidationPipe** com `skipMissingProperties: true`, `forbidNonWhitelisted: false`, alimentando `avisos[]`.

---

## 6. Camada offline

1. **Ordem obrigatória:** IndexedDB → fila → rede. Nunca o inverso.
2. `idLocal` UUID v4 gerado no dispositivo, antes de qualquer rede.
3. Worker de sync: backoff exponencial 1s → 2s → 4s → … teto 5 min. **Sem limite de tentativas** — desistir é perder dado.
4. Drenagem em lotes de até 100 via `POST /v1/contatos/lote`.
5. **Conflito** (versão local ≠ versão servidor): grava as duas em `conflito`, marca o registro, expõe na UI para escolha **campo a campo**. Nunca sobrescrever.
6. Item com 10 falhas consecutivas: **alerta visível** + botão "Exportar este registro como JSON". Silêncio na fila é a pior falha possível.
7. Service worker versionado. **Nunca cachear resposta de escrita.**
8. Câmera exige HTTPS. Em host sem TLS, mensagem explicando o motivo — nunca erro genérico de permissão.

---

## 7. Frontend

### 7.1 Telas

| Tela | Rota | Conteúdo |
|---|---|---|
| Captura | `/capturar` | Tela inicial. 3 botões grandes: **Ler QR** · **Digitar** · **Meu QR**. |
| Leitor QR | `/capturar/qr` | Câmera + "digitar em vez disso" sempre visível na mesma tela. |
| Formulário | `/contatos/:id` | Cartões colapsáveis, autosave, avisos discretos. |
| Lista | `/contatos` | Busca, filtro por status, badge de sincronização por item. |
| Duplicatas | `/duplicatas` | Fila de sugestões. |
| Merge | `/merge/:a/:b` | Dois registros lado a lado, escolha por campo. |
| Promoção | `/promover/:id` | **A única tela com campos obrigatórios.** Explica por quê. |
| Meu QR | `/meu-qr` | QR dinâmico com token do vendedor. |
| Autocadastro | `/p/:token` | Público. Formulário enxuto + termo + aceite. |
| Fila | `/fila` | Itens pendentes, presos, exportáveis. |

### 7.2 Regras de UI

1. **Nenhum campo obrigatório e nenhum botão de salvar desabilitado na captura.**
   `react-hook-form` **sem** resolver bloqueante — validação roda em paralelo e alimenta avisos.
2. **Caminho mínimo em 2 toques.** Medir e declarar no parecer do UI-04.
3. Autosave com debounce de 800ms. `PATCH` de um campo por vez.
4. **Três estados de sincronização, textualmente distintos:**
   `Salvo neste aparelho` (ícone de celular) · `Enviando…` (spinner) · `Sincronizado` (nuvem).
   **Jamais "Salvo" genérico para dado que só existe local.** Isso é mentira ao usuário.
5. Alvo de toque ≥ 48×48px. Fonte base ≥ 16px (evita zoom no iOS). Contraste AA.
6. Status **nunca só por cor** — sempre cor + texto ou ícone.
7. Aviso de validação: texto discreto abaixo do campo, cor de atenção. Nunca toast bloqueante, nunca borda vermelha agressiva em rascunho.
8. Ação irreversível (descartar, fundir, promover, exportar) exige confirmação **com resumo do efeito**. Nunca "Tem certeza?" vazio.
9. Funciona em 360px de largura. Testar antes de fechar o card.
10. shadcn/ui como base; componente custom só com justificativa.

### 7.3 Parsers de QR

Suportar: **vCard 2.1**, **vCard 3.0**, **MeCard**, **URL**, `mailto:`, `tel:`, texto livre.
Payload irreconhecível: grava em `origem.payloadBruto`, abre o formulário vazio, avisa que não reconheceu. **Nunca descartar a leitura.**

---

## 8. Integrações

| Integração | Regra |
|---|---|
| **BrasilAPI CNPJ** (fallback ReceitaWS) | Timeout 3s · circuit breaker em 5 falhas · cache 30d · payload cru preservado · **nunca bloqueante** |
| **ViaCEP** | Timeout 3s · cache permanente · nunca bloqueante |
| **Google Sheets** | Polling 5 min · marca d'água na última linha · idempotência por SHA-256 da linha normalizada · **reprocessar a planilha inteira não pode duplicar** |
| **Saída ERP** | `POST /v1/integracao/contatos-promovidos` · HMAC-SHA256 · versionado no caminho · sem consumidor no MVP |
| **Exportação** | CSV · XLSX · JSON · **sempre** gera registro em `exportacoes` com hash do arquivo |

**Regra transversal:** fonte externa **sugere**, nunca sobrescreve campo preenchido por humano. Divergência vira sugestão na UI.
**Credenciais:** env/secret. Zero chave, token ou ID de planilha no repositório — nem em teste, nem em fixture, nem em comentário.

---

## 9. Segurança e LGPD

### 9.1 Matriz `PERFIL_PERMISSOES` — fonte única de verdade

| Ação | vendedor | gestor | admin | auditor |
|---|---|---|---|---|
| Criar contato | ✅ | ✅ | ✅ | ❌ |
| Ler contato | própria carteira | tudo | tudo | tudo |
| Editar contato | própria carteira | tudo | tudo | ❌ |
| Ler trilha de auditoria | ❌ | ✅ | ✅ | ✅ |
| Transicionar → qualificado | ❌ | ✅ | ✅ | ❌ |
| Transicionar → cliente | ❌ | ✅ + TOTP | ✅ + TOTP | ❌ |
| Fundir contatos | ❌ | ✅ + TOTP | ✅ + TOTP | ❌ |
| Exportar base | ❌ | ✅ + TOTP | ✅ + TOTP | ❌ |
| Gerenciar usuários | ❌ | ❌ | ✅ | ❌ |

**Deny-by-default.** Rota sem `@Papel()` é negada.

### 9.2 Criptografia (ADR-004)

- `pf.cpfCifrado` / `pj.cnpjCifrado` — AES-256-GCM, chave em secret, **nunca no repositório**.
- `pf.cpfHash` / `pj.cnpjHash` — HMAC-SHA256 com pepper. **Este é o campo indexado.** Busca é exata, nunca parcial.
- `cpfMascarado` / `cnpjMascarado` para exibição em lista.
- Rotação de pepper exige reprocessamento — documentar o procedimento antes de produção.

### 9.3 Step-up TOTP

Exigido **apenas** em: promoção a cliente · merge · exportação · alteração de papel.
**Jamais na captura.** 2FA em campo é trava com outro nome.

### 9.4 Base legal automática

| Modo | Base legal | Finalidade padrão |
|---|---|---|
| `qr_proprio` | `consentimento` + timestamp + versão do termo + IP | "relacionamento comercial" |
| `google_forms` | `consentimento` (termo no formulário) | "relacionamento comercial" |
| `qr_lido` | `legitimo_interesse` | "prospecção comercial B2B" |
| `manual` | `legitimo_interesse` | "prospecção comercial B2B" |

Alterável em um toque. Nunca em branco. Nunca bloqueia.

### 9.5 Revogação e retenção

- `lgpd.revogadoEm` → bloqueia comunicação e exportação **imediatamente**.
- Após 30 dias: purga e-mail, telefone, endereço. **Preserva** `_id`, `codigo`, trilha de auditoria e o registro da própria revogação. Marca `purgadoEm`.
- Rascunho sem alteração há 180 dias: sinalizado para expurgo. Expurgo executado por rotina e **logado**, nunca silencioso.

### 9.6 Bloqueio conhecido

O **texto** do termo de consentimento não é redigido por agente (L7). Está aberto em `.grok/ESCALONAMENTOS.md`. Trava os cards F2-04 e F3-02. Fases 0 e 1 correm normalmente.

---

## 10. Qualidade de dado

### 10.1 Normalização — na escrita, sem rejeitar

| Campo | Regra | Se não normalizar |
|---|---|---|
| Telefone | E.164, assume `+55` sem DDI | Grava `bruto`, deixa `e164` vazio, gera aviso |
| E-mail | lowercase + trim | Grava como veio + aviso |
| CPF/CNPJ | só dígitos, valida DV | Grava como veio + aviso, **não bloqueia** |
| Nome | Title Case preservando preposições (`de`, `da`, `dos`) | Grava como veio |
| CEP | 8 dígitos | Grava como veio + aviso |

### 10.2 Score de completude

Pesos em **constante única**, testada por tabela. Determinístico, nunca heurística espalhada.

```
nome 20 · documento válido 20 · ao menos 1 telefone 15 · ao menos 1 e-mail 10
endereço completo 15 · tipoPessoa definido 10 · campos específicos PF/PJ 10
```

`score ≥ 25` dispara automaticamente `rascunho → capturado`.

### 10.3 Deduplicação em camadas

1. Exato por `cpfHash` / `cnpjHash` → similaridade `1.00`
2. Exato por e-mail normalizado → `0.95`
3. Exato por telefone E.164 → `0.90`
4. Fuzzy: Jaro-Winkler no nome ≥ `0.92` **E** cidade igual → score do algoritmo

Cada match grava **motivo e score** em `duplicataSuspeita[]`.

### 10.4 Merge

Nunca automático. UI lado a lado, divergências destacadas, escolha **por campo**.
Absorvido → `status: "descartado"` + `fundidoEm`. **Recuperável por 90 dias.**

### 10.5 Matriz e filial

`cnpjRaiz` igual com ordem diferente = **entidades distintas**. Registrar em `relacionados` com tipo `matriz`/`filial`. **Nunca** marcar como duplicata. Este é o falso positivo mais caro do sistema.

### 10.6 Precedência de valor

`digitado por humano` > `enriquecido de fonte oficial` > `parseado de QR`
Fonte de menor precedência **sugere**, nunca sobrescreve.

---

## 11. Testes — sete categorias obrigatórias

Declarar em cada card quais se aplicam **e justificar cada exclusão**.

1. **Funcional** — caminho normal.
2. **Captura sem trava** *(obrigatória em todo card que toque captura — é a defesa automatizada de L1)*: salvar `{nome:"Ana"}`; salvar com CPF malformado; dois rascunhos com o mesmo CPF coexistindo.
3. **Integridade de registro** — alteração em não-rascunho gera auditoria com valor anterior e novo; `deleteOne` impossível por ausência de rota; auditoria não aceita update.
4. **Offline e sincronização** — capturar offline → online sem duplicata; reenviar o mesmo `idLocal` 3×; matar a aba no meio do autosave; item preso gera alerta visível.
5. **Concorrência** — dois usuários no mesmo contato; dois capturando o mesmo lead; promoção disparada 2× no mesmo instante.
6. **Acesso indevido** — vendedor na carteira alheia; auditor tentando escrever; rota sem `@Papel()` (deve negar); exportação sem step-up.
7. **Dedup e merge** — falso positivo matriz/filial; merge sem confirmação (deve ser impossível); recuperação do absorvido dentro de 90 dias.

**Regras.** Nenhum card fecha só com caminho feliz. Todo bug vira **teste de regressão antes da correção**. A métrica não é cobertura — é **cenário crítico coberto nominalmente**.

---

## 12. Plano de execução

> **Paradas obrigatórias marcadas com 🛑. Parar significa parar: relatório e aguardar autorização escrita.**

### FASE 0 — Fundação

| Card | Agente | Entrega | Aceite |
|---|---|---|---|
| F0-01 | OPS-10 | Monorepo, Docker Compose, CI, lint, husky | `docker compose up` sobe api+web+mongo do zero em máquina limpa; `pnpm build` passa nos dois apps |
| F0-02 | ARQ-02 | Schemas + índices da seção 4 | Os 5 critérios abaixo |
| F0-03 | SEC-07 | Criptografia, matriz de papéis, bloco LGPD | ADR-004 confirmado e aplicado; guard nega rota sem decorator |
| F0-04 | DQ-08 | Normalização + score | Teste de tabela com 12 combinações passa |
| F0-05 | QA-09 | Suíte da Fase 0 | Categorias 1, 2, 3, 6 implementadas e verdes em CI |
| F0-06 | REV-11 | Portão | Veredito consolidado em `PROGRESS_FASE_0.md` |

**Aceite detalhado de F0-02:**
1. Salvar `{ nome: "Ana" }` persiste sem erro
2. Dois rascunhos com o mesmo CPF coexistem
3. Promover a `qualificado` com CPF já em uso retorna `CPF_DUPLICADO` (erro nomeado, não exceção do Mongo)
4. Alteração em não-rascunho gera linha em `contatos_auditoria` com valor anterior e novo
5. `tipoPessoa` default `INDEFINIDO` é persistível

🛑 **PARADA 1** — relatório e aguardar.

### FASE 1 — Captura

F1-01 API de contatos (API-03) · F1-02 Fila offline (SCAN-05) · F1-03 Leitura de QR e parsers (SCAN-05) · F1-04 Tela de captura (UI-04) · F1-05 Indicador de sincronização honesto (UI-04 + SCAN-05) · F1-06 Testes 1–6 (QA-09) · F1-07 Portão (REV-11)

**Aceite da fase:** capturar um lead **em avião**, fechar o app, reabrir, reconectar, e o lead chega ao servidor sem duplicata — testado em Playwright com rede simulada.

🛑 **PARADA 2**

### FASE 2 — Enriquecimento e ingestão

F2-01 CNPJ + CEP (INT-06) · F2-02 Google Sheets (INT-06) · F2-03 Dedup + tela de merge (DQ-08 + UI-04) · F2-04 QR próprio + autocadastro **[BLOQUEADO — termo jurídico]** · F2-05 Testes 1–7 (QA-09) · F2-06 Portão (REV-11)

🛑 **PARADA 3**

### FASE 3 — Saída controlada

F3-01 Promoção com step-up (API-03 + SEC-07) · F3-02 Exportação com log **[depende do termo]** · F3-03 Webhook ERP (INT-06) · F3-04 Backup 3-2-1 testado e cronometrado (OPS-10) · F3-05 Testes completos (QA-09) · F3-06 Portão final (REV-11)

🛑 **PARADA 4**

---

## 13. Protocolos

### 13.1 Relatório de parada

```
## RELATÓRIO — FASE <N> — <data>

### Executado
| Card | Agente | Status | Arquivos |

### Pareceres dos agentes
<o parecer de cada agente acionado, no formato do arquivo dele>

### Parecer QA-09
<formato do arquivo QA-09>

### Portão REV-11
<3 pareceres + conselho + veredito consolidado>

### Estado
BOARD: BACKLOG <n> · EM CURSO <n> · EM REVISÃO <n> · FEITO <n>
ADRs abertos neste ciclo:
Escalonamentos abertos:
Dívida técnica assumida conscientemente:

### Como verificar você mesmo
<comandos exatos que o usuário roda para confirmar o aceite>

### Autorização solicitada
Abrir FASE <N+1>? [aguardando]
```

### 13.2 Protocolo de parada por dilema

Encontrou colisão com L1–L7? **Não implemente.** Grave em `.grok/ESCALONAMENTOS.md`:

```
## [ABERTO] <data> — <ID do agente> — <título>
⚠️ O que está em aberto:
⚠️ Por que não posso decidir sozinho:
⚠️ O que já verifiquei:
⚠️ Opções conhecidas (sem recomendar):
```

E informe na mesma resposta. Siga com o que não depende disso.

### 13.3 Contexto saturando

Sintomas: escrever fora do escopo do agente · esquecer de atualizar o BOARD · gerar código que ignora `contatos_auditoria` · repetir trabalho já feito.
**Ação:** pare, diga que o contexto saturou, proponha quebrar o card. **Nunca** relaxe uma regra para caber.

---

## 14. Proibições absolutas

1. Campo obrigatório na tela de captura
2. Índice único **total** em CPF ou CNPJ
3. `deleteOne` / `findOneAndDelete` em `contatos`
4. Confiar em autoria ou timestamp vindos do cliente
5. Exibir "Salvo" para dado que só existe na fila local
6. Fusão automática de contatos
7. Sobrescrever dado digitado por humano com dado enriquecido
8. Tratar matriz e filial como duplicata
9. Credencial, token ou ID de planilha no repositório
10. 2FA na captura
11. Exportar base sem gerar log
12. Apagar trilha de auditoria em pedido de exclusão (apaga o dado de contato, preserva a evidência)
13. Citar RDC, artigo, prazo ou exigência legal não escrita neste repositório
14. Declarar algo pronto para produção sem veredito do REV-11
15. Pular uma parada 🛑

---

## 15. Frase de calibração

Antes de fechar qualquer card, responda a si mesmo:

> **"Um vendedor com uma mão ocupada, sol na tela e sem sinal consegue salvar este lead em dois toques — e, seis meses depois, um gestor consegue provar quem cadastrou, quando, com que base legal e o que mudou desde então?"**

Se qualquer metade for "não", o card não fechou.
