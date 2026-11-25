# ADRs — captura7

Formato: contexto · decisão · alternativas consideradas · consequências · status.
Status: `proposto` | `aceito` | `substituído por ADR-NNN`.

## ADR-023 — Pendências de campanha visíveis e aceite registrado na ficha

**Contexto.** Em 25/11/2026 o proprietário percebeu que a campanha deixava de fora contatos com telefone inválido ou sem aceite de contato comercial, mas não havia como saber quem eram para ajustá-los. A seleção mostrava o motivo só misturado na lista paginada de candidatos, e a ficha de um contato já sincronizado não tinha como registrar o aceite.

**Decisão.** `GET /v1/campanhas/pendencias` (gestor/admin) avalia os contatos ativos com a mesma regra de elegibilidade da prévia e devolve contagem por motivo, filtro por motivo, paginação de 30 e uma pista do telefone (quantidade de dígitos e final), nunca o número inteiro. Contatos descartados, fundidos ou eliminados ficam fora da lista. A leitura entra em `acessos_dados` como `campanhas_pendencias`. A tela Campanhas mostra o painel com orientação por motivo e link para a ficha. Na ficha, quem pode editar registra o aceite pendente pelo endpoint existente `POST /v1/contatos/:id/consentimento` (canal `vendedor_evento`, ADR-008), apenas depois de marcar "Confirmo que a pessoa autorizou receber contato comercial"; revogado não é reaberto por esse caminho. Quem pediu parada não tem atalho de ajuste.

**Alternativas.** Incluir automaticamente quem não tem aceite: rejeitado, a campanha exige autorização documentada (ADR-019/CP-04). Mostrar o telefone completo na lista: rejeitado, a ficha já mostra a quem tem acesso e a lista é de volume. Calcular a elegibilidade no banco: adiado; a avaliação em memória cobre até 5000 contatos e avisa quando trunca.

**Consequências.** O operador encontra e corrige os contatos antes de montar a campanha. O aceite registrado pelo operador vale como declaração dele, com nome, data e versão do termo na trilha; a prova mais forte continua sendo o titular marcar o aceite no QR ou no termo.

**Status.** aceito — 25/11/2026 — pedido do proprietário.

## ADR-022 — Telefone digitado só com DDD + número; lista de contatos ordenável

**Contexto.** Em 24/11/2026 o proprietário relatou que a captura parecia exigir o código do país no telefone e pediu que valesse só DDD + 9 dígitos do celular. A normalização do servidor já completava +55, mas a máscara do formulário guardava só os 11 primeiros dígitos: número colado ou autocompletado com +55 virava DDD 55 com o final cortado. Pediu também organizar a lista de contatos por data e ordem alfabética para localizar registros.

**Decisão.** Quem digita informa só DDD + número (10 dígitos fixo, 11 celular). A máscara descarta +55 e o 0 de longa distância quando vierem por colagem/autocompletar e o campo pede `tel-national` ao navegador. O servidor continua gravando E.164 com +55 (necessário para WhatsApp/campanhas), aceita também o 0 na frente do DDD e o aviso orienta "DDD + número". Número com `+` de outro país e número sem DDD seguem gravados como digitados, com aviso — entrada permissiva, sem campo obrigatório. A lista de contatos ganha busca, período de entrada (dias civis de São Paulo, como ADR-015) e ordem mais recentes / mais antigos / nome A–Z; o A–Z usa colação `pt` sem acento e maiúscula, também no cursor de paginação.

**Alternativas.** Exigir o +55 no campo: rejeitado, é justamente o atrito relatado. Validar e recusar número sem 11 dígitos: rejeitado pelo princípio "entrada permissiva, saída controlada". Ordenar A–Z por comparação binária: rejeitado, nomes acentuados iriam para depois do Z.

**Consequências.** Contatos novos com DDD + número entram já com E.164 e ficam elegíveis a WhatsApp. Registros antigos gravados com número cortado não são corrigidos automaticamente. A ordem A–Z não usa índice dedicado; aceitável no volume atual.

**Status.** aceito — 24/11/2026 — pedido do proprietário.

## ADR-021 — Atualização cadastral por link pessoal após interesse em parceria

**Contexto.** Durante a campanha manual pós Tattoo Week, contatos interessados precisam receber atendimento mesmo com uma única pessoa operando as conversas. O QR público existente cria outro lead e não pode ser usado para editar um registro já existente.

**Decisão.** Gestor/admin gera, por contato, um link pessoal de atualização válido por sete dias e de uso único. O token de alta entropia fica armazenado somente como hash. A página pública permite confirmar nome, WhatsApp, e-mail, cidade e UF; não pede senha, CPF, endereço nem altera consentimento. A confirmação atualiza o mesmo contato e mantém autoria/auditoria do responsável que emitiu o link.

**Consequências.** O operador envia o link apenas após conversar com o interessado. Quem abre o link vê somente os dados mínimos daquele contato; depois do envio, o token não pode ser reutilizado. Agendamento de conversa permanece manual nesta fase.

**Status.** aceito — 23/11/2026 — pedido do proprietário.

## ADR-020 — Modo de envio manual pelo WhatsApp Web até a contratação da Cloud API

**Contexto.** Em 23/11/2026 o proprietário informou que a Tela Viva ainda não tem WhatsApp Business API; antes usava um servidor paralelo não oficial, enviando poucas mensagens por vez. Pediu para enviar individualmente cada mensagem até contratar a API da Meta, aproveitando a campanha e sem apagar o caminho da API.

**Decisão.** A campanha ganha `modo: 'api' | 'manual'` (ausente = `api`, compatível com ADR-019). No modo manual: preparar não exige template nem configuração da Meta; `iniciar`/`retomar` são recusados (422) e o worker ignora campanhas manuais. Cada destinatário preparado tem o botão "Enviar pelo WhatsApp": o servidor revalida autorização/bloqueio/telefone, aplica o intervalo da cadência entre primeiras aberturas (429 com segundos restantes; reabrir não espera), registra `aberto_manual` + evento + `acessos_dados`, e devolve telefone e texto. A tela abre o link oficial de clique para conversar (`web.whatsapp.com/send` no computador, `wa.me` no celular) com o texto pronto; o envio só ocorre quando o gestor clica enviar no WhatsApp. A aba do WhatsApp é aberta sem `opener`.

**Alternativas.** Integrar o CRM ao servidor paralelo não oficial: rejeitado (risco de banimento do número da empresa e de violação dos termos do WhatsApp). Copiar números para envio fora do CRM: rejeitado (sem revalidação de opt-out, sem trilha). Automatizar o clique de envio no WhatsApp Web: rejeitado pelo mesmo motivo do servidor paralelo.

**Consequências.** Campanhas podem sair hoje, uma a uma, com o mesmo público, exclusões e auditoria. O sistema não sabe se a mensagem foi de fato enviada (estado "Aberto no WhatsApp"); respostas e pedidos de SAIR chegam no celular e devem ser registrados no contato (revogação) para valer nas próximas campanhas. Ao contratar a Cloud API, novas campanhas usam `modo: 'api'` sem migração.

**Status.** aceito — 23/11/2026 — pedido do proprietário.

## ADR-019 — Campanhas WhatsApp históricas com revisão explícita e fila controlada

**Contexto.** Em 23/11/2026 o proprietário autorizou implementar o que falta para campanhas aos contatos da Tattoo Week no CRM Tela Viva. A preparação anterior tem Cloud API oficial, recibos e bloqueios, mas só boas-vindas a leads novos. O público da feira não pode ser inferido de toda a base nem receber mensagens durante o desenvolvimento.

**Decisão.** Acrescentar Campanhas à interface existente e módulo NestJS/Mongo aditivo, sem Python/Redis e sem alterar contatos/captura. Gestor/admin prepara rascunho, seleciona explicitamente IDs autorizados, consulta exclusões/deduplicação, revisa mensagem/template e ritmo, inicia com confirmação, pausa/retoma/cancela e acompanha resultados. Versão e autor/horário do servidor protegem alterações; eventos append-only registram operações. Coleções próprias de campanhas/fila/controle, sem índice único global por contato que impediria campanhas distintas; unicidade por campanha/telefone hash e revisão de elegibilidade imediatamente antes de transmitir. Sem cópia de telefone/token nos trabalhos.

Usar a Cloud API oficial e compartilhar recibos/opt-out existentes. Reutilizar verificação HMAC dos webhooks; reconhecer também respostas recebidas por hash/horário, sem armazenar conteúdo de conversa desnecessário. Separar ritmo global persistido do agendamento individual: reserva atômica impede envios simultâneos entre workers/campanhas; limites de intervalo, lotes, pausa, dias/horários de São Paulo e teto diário são escolhas operacionais configuráveis, sem promessa contra bloqueio. Rejeição429 respeita Retry-After; resultado ambíguo fica incerto, sem reenvio cego. Reservas vencidas após reinício também ficam incertas.

Mensagem real deve corresponder a template de marketing aprovado e verificado pela API da Meta (WABA ID privado para consulta), não a texto livre digitado como se fosse template aprovado. O rascunho pós-feira contém link do vídeo fornecido e opt-out, sem alegações clínicas ou transcrição inventada; enquanto não houver template compatível aprovado, permanece rascunho. Interface mostra configuração pendente sem expor credenciais. Flags operacionais próprias nascem desligadas; números, tokens e templates não são inventados nem copiados de outro sistema. Não ativar nem enviar mensagem real nesta implementação/QA. Remetente, conta e credenciais externos serão configurados privadamente pelo proprietário.

**Alternativas.** Automação de cliques em WhatsApp Web ou app Python separado: não adotadas, pois já existe transporte oficial no CRM. Reutilizar a fila de boas-vindas com índice único por contato: rejeitado por misturar gatilhos e ignorar público histórico. Enfileirar toda a base implicitamente: rejeitado; seleção é explícita e autorização revalidada.

**Consequências.** O módulo pode ser usado para preparar campanhas antes das credenciais. Início real exige configuração, template aprovado e confirmação na interface. Instalação e volumes existentes preservados. Envio de e-mail em massa não integra esta entrega específica de WhatsApp; o rascunho de proposta por e-mail permanece disponível. Regressões incluem rotina de boas-vindas, segurança/RBAC, concorrência, retomada, exclusões e UI móvel. A implantação/publicação da versão segue os mecanismos e permissões existentes; nenhuma campanha é iniciada automaticamente.

**Status.** aceito para implementação — 23/11/2026 — autorização do proprietário: “pode fazer o que falta”.

---

## ADR-001 — Entrada permissiva, saída controlada

**Contexto.** O usuário determinou que o app "não pode ter travas". O usuário primário
é vendedor em campo: corredor de hospital, feira, visita. Campo obrigatório em captura
de campo mata a captura e empurra o vendedor de volta para papel e WhatsApp.
Ao mesmo tempo, dado de contato sem nenhuma disciplina vira base inutilizável em seis meses.

**Decisão.** Nenhuma trava na captura. Todo controle de qualidade é **assíncrono**
(enriquecimento, dedup, score de completude) ou fica no **último metro** (promoção
lead → cliente). O registro nasce `status: "rascunho"` com qualquer quantidade de campos.

**Alternativas consideradas.**
- *Formulário com campos mínimos obrigatórios:* rejeitada — é exatamente a trava que o usuário vetou.
- *Zero controle em qualquer ponto:* rejeitada — sem gate de promoção não há como garantir
  integridade do cadastro que alimenta faturamento e entrega.

**Consequências.** Base de rascunhos vai conter lixo e duplicata por design. Isso é aceito e
tratado por DQ-08, não prevenido por bloqueio. Exige índice único **parcial** (só não-rascunho).

**Status.** aceito · 2026-09-25

---

## ADR-002 — captura7 nasce isolado do ERP, com saída preparada

**Contexto.** Em aberto se este cadastro alimenta o ERP da Sette (e portanto a cadeia
de rastreabilidade lote→cliente) ou se é ferramenta comercial autônoma.

**Decisão.** MVP **isolado**. Sem integração de escrita com o ERP. A saída é modelada
desde já como contrato estável — `POST /integracao/contatos-promovidos` com payload
versionado e assinatura HMAC — mas o consumidor não existe ainda.

**Alternativas consideradas.**
- *Integrar de saída no MVP:* rejeitada — acopla dois sistemas antes de o primeiro existir.
- *Ignorar a saída:* rejeitada — adaptar depois custa mais que desenhar o contrato agora.

**Consequências.** Se e quando o cadastro passar a alimentar rastreabilidade regulatória,
o gate de promoção (F3-01) vira **obrigatório e estrito** — CNPJ validado contra Receita,
endereço de entrega confirmado — porque cliente incorreto quebra fechamento de recall.
Até lá o gate é de qualidade comercial, não regulatório.
**Reverter custa:** ativar F3-03 e endurecer as regras de F3-01. Barato.

**Status.** aceito · 2026-09-25 · reavaliar quando o ERP tiver módulo de clientes vivo

---

## ADR-003 — Google Forms por polling da Sheets API, não webhook

**Contexto.** Duas rotas: Apps Script disparando webhook em tempo real, ou leitura
periódica da planilha de respostas.

**Decisão.** **Polling** da Google Sheets API a cada 5 minutos, com marca d'água na
última linha processada e idempotência por hash da linha.

**Alternativas consideradas.**
- *Apps Script → webhook:* mais imediato, mas exige endpoint público, gestão de segredo
  HMAC e um script vivo fora do repositório — um ponto de falha que ninguém monitora.

**Consequências.** Atraso de até 5 minutos entre resposta e aparecimento no app. Aceitável:
lead de formulário não é operação de tempo real. Migrar para webhook depois é troca de
adaptador, o normalizador de payload é o mesmo.

**Status.** aceito · 2026-09-25

---

## ADR-004 — CPF e CNPJ criptografados em repouso, com índice sobre hash

**Contexto.** CPF é dado pessoal cuja exposição em dump de banco é incidente reportável.
Mas o campo precisa ser indexado para deduplicação e verificação de unicidade.

**Decisão.** Armazenar `pf.cpf` cifrado (AES-256-GCM, chave em env/secret, nunca no repo)
e manter `pf.cpfHash` (HMAC-SHA256 com pepper) como o campo **indexado**. Unicidade e
dedup operam sobre o hash. Mesma estratégia para `pj.cnpj`.

**Alternativas consideradas.**
- *Texto puro:* rejeitada — dump de banco vira vazamento de base de CPFs.
- *Somente hash, sem cifra:* rejeitada — o valor precisa ser exibido e exportado.

**Consequências.** Busca por CPF é exata, nunca parcial. Rotação de pepper exige
reprocessamento da coleção — documentar o procedimento antes de produção.

**Status.** aceito · 2026-09-25 · confirmado e aplicado no F0-03

---

## ADR-005 — Model ID inicial desta execução

**Contexto.** `.grok/config.md` exige que o model ID em uso seja preenchido e que a configuração seja registrada como ADR, com data. O identificador precisa ficar só nesse arquivo e neste ADR.

**Decisão.** Registrar o model ID `grok-4.7` em 2026-09-25, que é o identificador do modelo desta execução. Não houve troca: é a configuração inicial. Nenhum outro arquivo do repositório deve citar modelo pelo nome.

**Alternativas consideradas.**
- *Deixar o placeholder:* rejeitada — o próprio `config.md` manda preencher antes do trabalho.
- *Espalhar o identificador em rules e personas:* rejeitada — quebra a portabilidade do banco de agentes.

**Consequências.** Troca futura segue o comando descrito em `.grok/config.md`: atualizar só aquele arquivo, abrir outro ADR e varrer o repositório.

**Status.** aceito · 2026-09-25

---

## ADR-007 — Índice parcial de CPF/CNPJ usa `$in` no status

**Contexto.** A seção 4.4 pede `partialFilterExpression` com `status: { $nin: ["rascunho", "descartado"] }`. No MongoDB 7.0.24 essa expressão é reescrita para `$not`/`$in` e o servidor recusa criar o índice: "Expression not supported in partial index". Sem o índice, o critério 3 do F0-02 não existe.

**Decisão.** Gravar o filtro como `status: { $in: ["capturado", "qualificado", "cliente"] }` junto com a existência do hash. O enum de status é fechado; o conjunto é o complemento de rascunho e descartado. Rascunho e descartado continuam fora da unicidade. O índice permanece parcial e único só no hash, nunca no valor puro.

**Alternativas consideradas.**
- *Manter `$nin` literal:* rejeitada — o `createIndex` falha e a suíte não sobe.
- *Índice único total:* rejeitada — quebra L1 e a ADR-001.
- *Dois índices parciais, um por status:* rejeitada — unicidade não atravessa os índices.

**Consequências.** Se um status novo entrar no enum e precisar da mesma unicidade, o `$in` tem que ser atualizado no mesmo card. A expressão literal da seção 4.4 não é executável neste servidor.

**Status.** aceito · 2026-09-25

---

## ADR-006 — Esqueleto da Fase 0 e composição por descoberta

**Contexto.** O card F0-01 (seção 12) entrega o monorepo `apps/api` + `apps/web` com `pnpm build` nos dois apps. O glob permanente do OPS-10 não lista `package.json` nem entrypoints. `apps/api/src/**` (exceto schemas) é do API-03 e `apps/web/src/**` é do UI-04; nenhum dos dois é despachado na Fase 0. Sem entrypoint não existe build. A regra do ORQ-01 exige reverter entrega fora do glob.

**Decisão.**
1. O F0-01 cria somente o esqueleto de build: entrypoints mínimos, health check, lint, husky, Compose e CI. Sem tela de captura, sem endpoint de contato, sem schema.
2. Depois do esqueleto, agente não edita arquivo de outro. O encadeamento é por descoberta: `main.ts` carrega registradores com `require` de caminho variável (o build passa se o arquivo ainda não existe) e o `AppModule` importa todo `*.module.js` compilado, pulando o próprio `AppModule`. SEC-07, DQ-08 e ARQ-02 gravam só nos próprios globs.
3. `app.module.ts`, `main.ts` e o placeholder web não voltam a ser editados nos cards seguintes da Fase 0.
4. Testes de aceite ficam no glob do QA-09 (`apps/api/test/**`, `apps/web/src/**/*.test.ts*`). O teste de tabela do F0-04 vive em `apps/api/src/qualidade/**`, glob do DQ-08, porque o aceite daquele card é a tabela executável.

**Alternativas consideradas.**
- *Não criar entrypoint e reprovar o F0-01:* rejeitada — a seção 12 manda os dois apps compilarem.
- *Despachar API-03 e UI-04 na Fase 0:* rejeitada — a parada 1 proíbe abrir agente de fase seguinte, e o usuário mandou parar antes da Fase 1.
- *Cada card editar `app.module.ts`:* rejeitada — o arquivo teria dois donos no mesmo ciclo.

**Consequências.** Feature nova entra como módulo descoberto, não como edição do entrypoint. Se a descoberta falhar em silêncio, o guard deixa de ser global: o F0-05 cobre isso com teste do `APP_GUARD` no `AuthModule` e com a suíte HTTP do guard.

**Status.** aceito · 2026-09-25

---

## ADR-008 — Captura mínima com consentimento pendente

**Contexto.** A ADR-001 e a L1 proíbem campo obrigatório e botão de salvar desabilitado na captura de campo. A decisão D3 do dono (2026-09-26, opção a) manda colher o consentimento na hora, na mesma tela do autocadastro, com as caixas marcadas pelo titular. A Parte 3 da minuta diz para não concluir o registro de evento sem consentimento de contato comercial. As duas regras parecem se excluir.

**Decisão.** O rascunho pode ser salvo com `lgpd.contatoComercial: "pendente"`. Esse estado fica visível e não é apresentado como autorização. Contato comercial, envio ao ERP e exportação ficam bloqueados até existir registro de consentimento daquela finalidade. A conclusão do autocadastro (D4) é outra tela: o botão "Concluir cadastro" só habilita com a caixa de contato comercial. A base do enriquecimento continua legítimo interesse; planilha e QR não recebem consentimento automático. O mapeamento antigo de `qr_proprio` e `google_forms` para `baseLegal: consentimento` fica substituído por esta ADR.

**Alternativas consideradas.**
- *Caixa obrigatória na captura:* rejeitada — viola a L1 e a ADR-001.
- *Legítimo interesse para o contato comercial de evento:* rejeitada — o dono removeu essa alternativa na D3.
- *Recusar gravar qualquer rascunho sem caixa:* rejeitada — o dono autorizou salvar com consentimento pendente, desde que o bloqueio das saídas seja honesto.

**Consequências.** Existe lead sem base de contato comercial. Isso é estado explícito, não omissão. A trilha não guarda nome, e-mail nem telefone em claro (D10). O envio ao ERP continua sem finalidade coletada enquanto a D7 estiver aberta, então o webhook não entrega ninguém.

**Status.** aceito · 2026-09-26

---

## ADR-009 — QR de autocadastro com prazo e uso único

**Contexto.** O token emitido em `POST /v1/qr` não expirava e podia concluir vários cadastros. O limite por IP do autocadastro também acumulava endereços para sempre e, atrás do nginx do Compose, via todo mundo como o IP do proxy.

**Decisão.** O token vale 2 horas (`QR_TOKEN_TTL_SEGUNDOS`, inteiro de 60 a 86400) e 1 conclusão (`QR_TOKEN_MAX_USOS`, inteiro de 1 a 20). Tentativa sem a caixa de contato comercial não gasta o uso. Esgotar, expirar ou revogar responde 410 e não grava contato. Quem emitiu, o gestor ou o admin revoga em `POST /v1/qr/:token/revogar`. O nginx do Compose grava só `$remote_addr` em `X-Forwarded-For`, sem acrescentar o valor que o cliente mandou. A API só confia nesse salto quando `CAPTURA7_TRUST_PROXY_SALTOS` é um inteiro de 1 a 5; `true` é recusado. O Compose usa `1`.

**Alternativas consideradas.**
- *Token eterno de uso ilimitado:* rejeitada — o link vazado cadastra para sempre.
- *`trust proxy: true`:* rejeitada — qualquer cliente na porta publicada da API escolheria o IP do limite.
- *Subchaves HKDF do pepper:* não feita. O mesmo `CIFRA_PEPPER` ainda assina o hash do documento e o pseudônimo da auditoria. Separar as chaves mudaria hashes já gravados. Fica pendente até existir plano de rehash.

**Consequências.** Um QR de banca precisa ser reemitido depois de um cadastro ou de duas horas. Visitantes diferentes atrás do nginx não dividem o balde de 3 pedidos por minuto.

**Status.** aceito · 2026-09-26

---

## ADR-010 — Uso pessoal no computador do controlador

**Contexto.** Os PRs 1 a 5 estavam na `main`. Em 26/09/2026, às 17h26 BRT, o dono autorizou por escrito: "Autorizo o PR que libera tudo. Não tenho ERP por enquanto e vou rodar no meu computador." O captura7 não será vendido. Não há CNPJ nem empresa controladora. A LGPD continua aplicável à pessoa física que trata dados pessoais.

**Decisão.**

- **D1.** O controlador é a pessoa física Erico Henrique de Lima Araujo. Não há razão social nem CNPJ. A versão do termo é o literal `2026-09-26-uso-pessoal`. O e-mail de contato vem de `CONTROLADOR_EMAIL` e aparece no termo. Sem valor, o termo mostra "o e-mail do controlador", sem o nome da variável.
- **D2.** Não há encarregado separado. O canal do titular é o e-mail do controlador.
- **D5.** O contato comercial usa os canais que o titular informar no cadastro. Não há número de WhatsApp corporativo inventado.
- **D7.** Não há ERP. A saída continua o webhook assinado. `ERP_WEBHOOK_URL` vazio, ausente ou placeholder deixa o envio desligado: a promoção segue, o estado fica `nao_configurado` e `ultimoErro` fica vazio. O POST só ocorre com URL e segredo reais e com consentimento `envio_erp`. A caixa dessa finalidade é opcional no autocadastro e no formulário interno, desligada por padrão. Com a URL vazia, marcar a caixa não envia nada.
- **D8.** O administrador exporta CSV e XLSX em `GET /v1/exportacoes`, com os filtros `status` e `origem`, depois do passo extra do TOTP. Só entram contatos com `lgpd.contatoComercial` igual a `concedido` e sem `eliminadoEm`. Revogados, eliminados e sem consentimento ficam de fora. A trilha `auditoria_exportacao` guarda quem (id e papel), formato, filtros, quantidade e quando. A finalidade é o uso pessoal do controlador. JSON não entra. A tela de exportar e importar só aparece para quem tem a permissão da rota.
- **D9.** O cadastro sem interação por `RETENCAO_MESES` (padrão 24, inteiro de 1 a 120) é eliminado pelo job horário. O prazo aparece no termo. A trilha de auditoria não é apagada.
- **D11.** CSV, XLSX e a sincronização já existente da planilha entram com origem `importado`, base legal `legitimo_interesse` e deduplicação por e-mail, telefone, CPF ou CNPJ. Sem esses identificadores, a linha conta como repetida quando o nome normalizado já existe, e também a empresa ou instituição quando a planilha traz essa coluna. Nome com outra empresa continua novo. Não há fusão automática. A tela aceita texto colado e arquivo CSV ou XLSX. O consentimento não é copiado da coluna.
- **D3, neste uso.** O lead de evento sem consentimento continua `contatoComercial: pendente` e `baseLegal: legitimo_interesse`, como a ADR-008. Quando o titular concede o consentimento, a base das finalidades consentidas passa a ser `consentimento`: contato comercial e, se a caixa opcional estiver marcada, envio ao ERP. Planilha importada permanece em legítimo interesse. O lead pendente não é promovido a consentimento sozinho.
- **D9, prazos curtos.** `PURGA_REVOGACAO_DIAS` (padrão 30, inteiro de 1 a 3650) apaga os dados do cadastro depois da revogação e remove o documento do contato 30 dias após `eliminadoEm`. A trilha de auditoria não entra nesse apagamento. `RASCUNHO_DIAS` (padrão 180) elimina o rascunho sem alteração nesse prazo; o documento sai 30 dias depois, no mesmo job.
- **D12.** O computador local do controlador continua um caminho válido, descrito em `INSTALAR-WINDOWS.md`. A publicação na nuvem, com Google Firebase Hosting, Render e MongoDB Atlas, está na ADR-011. O build do site aceita `VITE_API_URL` e a API aceita `CORS_ORIGENS`.
- **Captcha.** Todo autocadastro público resolve um desafio. O padrão `CAPTCHA_PROVEDOR=local` é uma soma no servidor, de uso único, sem conta externa. `hcaptcha` e `turnstile` substituem o desafio quando o segredo existe; sem segredo o cadastro não grava. A tela mostra a soma por padrão e, quando `HCAPTCHA_SITEKEY` ou `TURNSTILE_SITEKEY` vem na resposta do captcha, carrega o widget correspondente. Prazo de 2 horas, uso único e revogação do QR permanecem os da ADR-009.
- **Login.** Sessão por usuário e senha com scrypt e token opaco. Quem já inscreveu o autenticador precisa do código no login (`TOTP_OBRIGATORIO` se faltar). O administrador, no primeiro acesso, recebe `precisaInscreverTotp` e fica limitado a inscrever o autenticador, sair, ver a própria sessão e trocar a senha até existir um segredo. Qualquer papel inscreve o próprio autenticador. `POST /v1/auth/sair` apaga o token no servidor. `POST /v1/auth/senha` pede a senha atual e uma nova com 12 ou mais caracteres, grava com scrypt e registra `troca_senha` em `auth_auditoria` sem a senha. `pnpm criar-admin` cria o primeiro administrador e não troca a senha se o login já existe. Cabeçalhos de teste continuam ignorados em `NODE_ENV=production`. Fora do modo de teste o aplicativo não cria a sessão fixa "Vendedor deste aparelho": o perfil é o do usuário que entrou.
- **Conflito.** O schema passa a ter `conflito`. Na versão divergente o servidor grava as duas versões. `POST /v1/contatos/:id/resolucao` com `escolha: local` ou `servidor` grava a escolha humana. A escolha local grava o valor que estava no aparelho e usa o número de versão do servidor na escrita condicional, de modo que o valor local permanece. Servidor só remove o conflito.
- **Revogação e eliminação.** A tela pede confirmação. A revogação só grava com `confirmar: true`. A eliminação pelo titular só grava se o corpo trouxer `ELIMINAR` ou o nome atual. O job de expurgo continua chamando a eliminação interna sem essa frase. Não há passo TOTP novo nessas rotas.
- **Documento repetido na edição.** CPF ou CNPJ já usado por outro contato fora de rascunho responde 422 `CPF_DUPLICADO` ou `CNPJ_DUPLICADO` e não grava a edição. O aplicativo mostra essa frase e não tenta de novo. Não há sucesso com aviso no lugar do erro.
- **Fusão.** O código de 6 dígitos enviado no corpo é conferido no servidor. Sem código, só segue quem já confirmou o passo extra.

**Alternativas consideradas.**

- *Manter os colchetes e as travas:* rejeitada — o dono autorizou o uso pessoal e a retirada das travas D8 e D11.
- *Inventar CNPJ, razão social ou DPO:* rejeitada — não existem.
- *Webhook obrigatório ou erro quando a URL está vazia:* rejeitada — não há ERP e o fluxo não pode parecer quebrado.
- *Captcha só a partir da quarta tentativa, dependente de conta externa:* rejeitada — o uso local precisa funcionar sem essa conta.
- *Apagar a trilha de auditoria no mesmo prazo do cadastro:* rejeitada — a trilha continua imutável.

**Consequências.** A ADR-008 segue valendo para a captura de campo: rascunho com consentimento pendente não libera contato comercial. Esta ADR substitui, neste uso pessoal, o bloqueio de exportação, o bloqueio de uso do lead importado, a ausência de login e os placeholders do termo. A subchave HKDF do pepper continua pendente, como na ADR-009. O Compose assina o certificado do site com uma CA local (`ca.crt`), com SAN para `localhost`, `127.0.0.1` e os IPs em `CERT_IPS`. O celular e o computador precisam instalar essa CA. No iPhone, a confiança total fica em Ajustes, Geral, Sobre, Ajustes de Confiança do Certificado. Visitante do QR na mesma rede precisa da mesma CA: um IP privado não recebe certificado de uma autoridade pública. Sem a CA instalada, o aviso do navegador continua e o aplicativo offline pode não instalar. O caminho sem Docker carrega o `.env` da pasta atual e o da raiz ao subir `node dist/main.js`. A pasta atual prevalece. Variável que o processo já tenha não é coberta.

**Status.** aceito · 2026-09-26

---

## ADR-011 — Tela Viva: CRM para representantes de saúde

**Contexto.** Em 16/11/2026 o usuário pediu a reformulação do CRM como Tela Viva, inspirado no setor farmacêutico e de produtos médicos, e confirmou o foco em representantes comerciais gerenciando carteiras e visitas.

**Decisão.** Preservar React/Vite PWA, NestJS, MongoDB, sessões, contatos e captura permissiva. Acrescentar um módulo comercial aditivo com contas/instituições, produtos representados, oportunidades por etapa, visitas/tarefas e propostas com itens. As entidades comerciais ficam separadas da captura e não migram nem apagam contatos existentes. A conta registra segmento, cidade, UF, especialidade/área, responsável e próxima ação; produtos registram linha, fabricante, categoria, unidade e preço de referência. Campos setoriais são metadados comerciais voluntários, sem alegação de validação regulatória.

A API aplica autoria do servidor, carteira do representante, leitura de gestão/auditoria conforme perfil e versionamento otimista. Toda mutação comercial guarda evento de auditoria append-only junto ao próprio registro (operação atômica de documento), sem valores pessoais em claro na trilha. Arquivamento é lógico. Valores monetários são calculados em centavos no servidor; propostas são rascunhos internos, com impressão local, sem envio externo automático. O dashboard usa dados reais e estados vazios, sem seed de produção. Sem sessão ou sem rede, as telas comerciais explicam o estado; captura e fila offline permanecem disponíveis. Operações comerciais novas exigem rede, sem simular sincronização offline que não existe.

**Alternativas consideradas.** Reescrever todo o armazenamento destruiria compatibilidade; implementar um ERP/estoque/faturamento ou prontuário extrapolaria o pedido. Publicação externa e mudança do controlador/termo não são parte da reformulação local.

**Consequências.** A identidade visual passa a Tela Viva; identificadores internos captura7, banco e chaves existentes são preservados por compatibilidade. O produto organiza atuação de representantes, não substitui sistemas regulatórios, estoque nem prontuário. Integrações existentes permanecem configuráveis sem contas ou credenciais inventadas.

**Status.** aceito · 2026-11-16 · escopo autorizado pelo usuário.

---

## ADR-012 — Identidade oficial do repositório Tela Viva

**Contexto.** O usuário informou em 16/11/2026 que as informações, logo e ícones oficiais estão no repositório local `C:\Users\erico\telaviva`. A leitura de README, CLAUDE.md, index.html, CSS e arquivos de marca confirmou que Tela Viva é a marca de cuidados para pele tatuada, representante Pele Rara® para esse segmento. O modelo comercial continua inspirado em carteiras e visitas de representantes, conforme foco confirmado pelo usuário.

**Decisão.** Usar os assets originais de `public/brand/`, favicon e ícone de instalação por cópia para este CRM, sem editar o repositório fonte. Adotar paleta areia/blush/sálvia e tipografia Playfair Display + Inter; substituir a direção provisória verde petróleo. Acrescentar segmentos estúdio de tatuagem e profissional autônomo e categorias comerciais cosmético/kit. Não preencher preços, registros sanitários, alegações terapêuticas ou credenciais a partir de suposições. O catálogo começa vazio, podendo ser preenchido pelo administrador com dados confirmados do fabricante. Fotografias de fabricante não serão alteradas nem receberão a marca Tela Viva.

O site identifica a operadora JSETTE7 e publica contatos comerciais oficiais. O CRM histórico usa controlador pessoa física; essa diferença foi submetida ao usuário. Até a resposta, não mudar o controlador do consentimento nem os dados legais do emissor por inferência. Marca e produto podem ser atualizados de imediato.

**Consequências.** Assets e fontes necessários são locais e preservam funcionamento offline. Nenhuma alteração no site/worker externo nem envio de mensagens a terceiros. Os pacotes, volume Mongo e identificadores internos permanecem compatíveis.

**Status.** aceito · 2026-11-16 · fonte indicada expressamente pelo usuário.

---

## ADR-013 — JSETTE7 como operadora/controladora do Tela Viva

**Contexto.** A pergunta sobre a diferença entre a configuração pessoal histórica do CRM e o site foi respondida pelo usuário em 16/11/2026: "JSETTE7, conforme os dados do site". A confirmação vale para consentimento e identificação nas propostas.

**Decisão.** A identidade exibida passa a JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA, CNPJ 54.765.439/0001-34, Av. Paulo Afonso, 615, Nova Petrópolis, São Bernardo do Campo/SP, CEP 09770-351. Canal público confirmado no repositório fonte: settedistribuidora0777@gmail.com; WhatsApp comercial +55 (11) 91497-7007. O termo recebe versão `2026-11-16-tela-viva-jsette7`, identifica a empresa e o canal, sem inventar um encarregado nominal. A finalidade de organização deixa de ser descrita como uso pessoal da pessoa física. Mantêm-se os controles já existentes de consentimento, retenção, exportação e envio externo opcional. `CONTROLADOR_EMAIL` continua configurável; sem valor, o padrão público é o contato confirmado da empresa.

**Consequências.** Substitui os trechos de identidade pessoal da ADR-010 para novas telas/novos consentimentos. Registros históricos de consentimento e suas versões não são reescritos. A implantação permanece local e preserva volumes/usuários; não há migração de infraestrutura nem ativação de serviços externos.

**Status.** aceito · 2026-11-16 · confirmado expressamente pelo usuário.

## ADR-014 — Paridade comercial local com a referência de treinamento

**Contexto.** Em 16/11/2026 o usuário autorizou ampliar o Tela Viva para acompanhar, localmente, as funções do CRM apresentado no vídeo de treinamento. O CRM atual já cobre carteira, funil, agenda, catálogo e proposta impressa; faltam relacionamento com múltiplos interlocutores, preços negociados, aprovações, treinamentos, participantes/presença e proposta encaminhada ao contato.

**Decisão.** Evoluir por módulos aditivos na coleção `tela_viva_comercial`, sem reescrever nem importar automaticamente a base antiga. Guardar vários contatos no registro da conta e manter alterações na auditoria existente. Registrar preços negociados por conta/produto em entidade própria, com solicitação pelo representante e aprovação/reprovação por gestor/admin com motivo e versão. Registrar treinamentos e participantes como tipos comerciais próprios, vinculados à carteira; o QR abre somente a ficha daquele treinamento/inscrição, nunca dados da conta, oportunidade, paciente ou procedimento. Presença e confirmação são campos de participação auditados. Uma proposta pode ser preparada para o contato escolhido; sem provedor configurado, oferecer abertura de rascunho no cliente de e-mail e registrar apenas que o rascunho foi aberto, sem declarar que foi enviado.

Preservar o escopo de representantes e as permissões por carteira. Dados de paciente, cirurgia, estoque, faturamento, RH e módulos ERP ficam fora do escopo. Dados pessoais de participantes ficam visíveis apenas à carteira correspondente e a gestores/admin, sujeitos aos controles existentes. Nenhuma mensagem é enviada automaticamente; e-mail real depende de integração e configuração aprovadas posteriormente.

**Alternativas consideradas.** Uma coleção relacional nova por entidade: rejeitada para esta fase local, pois o módulo atual já tem envelope versionado/auditado e não requer migração destrutiva. Copiar os módulos médicos/ERP mostrados integralmente: rejeitada por incluir estoque, dados de saúde e operação hospitalar sem necessidade comprovada para representantes da Tela Viva.

**Consequências.** O módulo cresce sem alterar contatos capturados offline nem os dados existentes. A inscrição aberta por QR precisa de token restrito ao evento, limite de uso e proteção contra leitura de dados de clientes. A fase de e-mail não transmite enquanto não houver configuração local e ação explícita do usuário.

**Status.** aceito · 2026-11-16 · execução local autorizada pelo usuário.

## ADR-015 — Janelas dos relatórios no calendário de São Paulo

**Contexto.** A interface envia datas civis escolhidas no calendário local (`AAAA-MM-DD`), enquanto registros são persistidos como instantes UTC. Interpretar as datas como meia-noite UTC excluía registros criados à noite em São Paulo, embora ainda pertencessem ao dia selecionado.

**Decisão.** Interpretar `de` e `ate` como dias inclusivos no fuso `America/Sao_Paulo`. Converter o início de cada dia civil para UTC e consultar até o início do dia seguinte a `ate` (limite exclusivo). Validar datas de calendário e manter o limite de 366 dias contando dias civis. O filtro de auditoria e o período retornado preservam as datas enviadas.

**Consequências.** As agregações por `criadoEm` e data marcada incluem todo o dia local escolhido, inclusive registros após 21h BRT; a duração UTC da janela pode variar com mudanças de fuso. Nenhum dado individual é adicionado ao relatório.

**Status.** aceito para implementação local · 2026-11-16.

## ADR-016 — Boas-vindas WhatsApp em fila persistente, envio inicialmente desligado

**Contexto.** O usuário pediu em 18/11/2026 automação de boas-vindas para cada novo lead pela API do WhatsApp, com as dependências de background prontas e o envio desligado. O termo atual já prevê contato comercial por WhatsApp quando autorizado. A captura deve continuar permissiva e nenhuma credencial real foi fornecida.

**Decisão.** Acrescentar módulo NestJS independente, Cloud API oficial via `fetch` e fila/recibos/bloqueios em coleções Mongo aditivas. Não acrescentar Redis nem novo serviço. O worker reconcilia contatos novos com marco persistido no primeiro início do módulo e janela de elegibilidade de 24 horas; chave única por lead impede novos trabalhos por sincronização repetida ou reinício. A fila pode ser preparada localmente com a flag desligada, mas nunca faz HTTP externo quando `WHATSAPP_ENVIO_ATIVO` não é exatamente `true` ou a configuração está incompleta.

Antes da saída, consultar novamente consentimento ativo de contato comercial, telefone E.164 e situação do lead. Revogado/eliminado/descartado/fundido ou telefone com opt-out não recebe mensagem. O template aprovado é configurado na Meta, sem parâmetros dinâmicos, e a versão Graph é obrigatória no ambiente. O webhook valida HMAC dos bytes originais, verify-token e ID do número; persiste recibos mínimos e bloqueios HMAC para comandos de parada, sem guardar corpo/número em claro.

**Consequências.** Não há envio real nesta fase. Reservas atômicas e idempotência local impedem processamento concorrente do mesmo trabalho; resultado ambíguo de rede/5xx ou reserva perdida fica `incerto`, sem retry cego que poderia duplicar a mensagem. Rejeições 429 têm backoff e teto de cinco tentativas. Aceite HTTP não é tratado como entrega; apenas recibos assinados atualizam entrega/leitura. Nuvem, conta Meta, template aprovado, credenciais e webhook HTTPS público ficam para ativação futura; instruções estão em `docs/WHATSAPP.md`.

**Status.** aceito para preparação desativada · 2026-11-18 · autorização expressa do usuário.

## ADR-017 — Login simples e administração da equipe independente de inscrição TOTP

**Contexto.** Em 19/11/2026 o proprietário relatou falha e confusão na entrada e autorizou expressamente remover 2FA da página de login. Solicitou usuário que possa criar outros usuários. O login atual exige TOTP de inscritos; administradores sem inscrição ficam bloqueados em quase todas as rotas, inclusive criação de equipe.

**Decisão.** Autenticar entrada com usuário e senha, preservando scrypt, sessão opaca com prazo, bloqueio de tentativas, usuário ativo e RBAC. Nenhum login concede step-up; inscrição TOTP deixa de bloquear a sessão normal. Administrador pode listar e criar usuários sem TOTP. Operações sensíveis que já exigem confirmação adicional continuam protegidas. Separar login de configurações de conta/segurança/planilha em `/minha-conta`; sucesso leva ao painel. Login usa apenas usuário/senha e opção mostrar senha. Manter usuários, hashes, segredos TOTP, sessões e dados existentes, sem migração destrutiva. Identificar administrador do proprietário na base efetiva e testar gestão em ambiente isolado sem criar membros fictícios na base real.

**Consequências.** Substitui a exigência histórica de TOTP na entrada da ADR-010 e AC-01. TOTP fica restrito à confirmação de operações sensíveis, acessível na conta; não há concessão automática de privilégios. A implantação é local no ambiente já usado, sem nova publicação externa ou envio de mensagens.

**Status.** aceito para implementação e uso local · 2026-11-19 · pedido explícito do proprietário.

## ADR-018 — Produção na nuvem unificada e QR de evento

**Contexto.** O GitHub (Firebase Hosting + Render + Atlas) e a instalação local (Tela Viva, acesso simples, WhatsApp) divergiram. Para captação de leads em evento, o QR precisa abrir o pré-cadastro em endereço público e aceitar muitas pessoas no mesmo QR impresso. Um único computador não atende a equipe.

**Decisão.** Unificar as duas linhas em `main`: marca, rotas e acesso da versão Tela Viva (ADR-017); infraestrutura Firebase/Render/Atlas, captcha resistente ao sono do Render, autocadastro como capturado, listagem servidor e TOTP em duas etapas (inscrever → ativar) da linha do GitHub. O limite de usos por QR (`QR_TOKEN_MAX_USOS`) passa de 1–20 para 1–2000 e o prazo (`QR_TOKEN_TTL_SEGUNDOS`) de até 24h para até 72h; os padrões continuam 1 uso e 2h. Em produção de evento usa-se 2000 usos e 48h. O QR continua revogável a qualquer momento. O limite público por IP (10/min, captcha após 3) permanece; o nginx local aceita `CF-Connecting-IP` só para identificar o visitante atrás de túnel.

**Consequências.** Um QR impresso vazado permite até 2000 autocadastros dentro do prazo, contidos pelo captcha, pelo limite por IP e pela revogação. A captura continua sem campo obrigatório; a promoção lead → cliente continua exigindo TOTP ativado.

**Status.** aceito · 2026-11-19 · pedido explícito do proprietário (QR impresso único, produção correta sem túnel).
