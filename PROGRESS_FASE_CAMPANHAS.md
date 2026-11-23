# Tela Viva — Campanhas WhatsApp

## Despacho CC-00 — 23/11/2026

Autorização: “pode fazer o que falta”, em resposta à descrição de que faltam tela Campanhas, fila controlada, resultados e configuração para WhatsApp aos contatos históricos da feira.

Cards CP-02..CP-07 registrados em BOARD; ADR-019 aceita antes da implementação. ORQ-01 conduz implementação e revisão em sequência. Não alterar os materiais de treinamento, a captura permissiva, os contatos da base real ou outro sistema.

## Escopo

Campanhas no CRM existente: seleção explícita e elegibilidade de contatos históricos; mensagem pós Tattoo Week com vídeo fornecido; template real aprovado; cadência, horários de São Paulo, lotes, pausa, teto diário; iniciar/pausar/retomar/cancelar; fila persistente, reserva global, opt-out e resultados. Desenvolvimento/QA sem envio real, número inventado ou token exposto. Credenciais e template são configuração externa privada. A autorização para implementar não inicia campanha real.

## Ambiente observado

- Checkout inicial com materiais/arquivos da fase de treinamento ainda não commitados; preservar.
- Instalação possui caminhos Docker local e Firebase/Render. Docker Desktop não está em execução nesta conferência (pipe do daemon ausente).
- A `.env` local não possui configuração de WhatsApp preenchida. Apenas presença/ausência de chaves foi verificada, sem imprimir segredos.
- Alvo Hosting no `.firebaserc`: `tattooart`; repositórios remotos `origin` CRM-TATTO e `telaviva` CRM-TelaViva. Nenhum push, deploy ou envio executado nesta fase inicial.
- Pergunta opcional enviada ao proprietário sobre número empresarial/provedor, sem solicitar tokens em conversa. Implementação segue independentemente da resposta.

## Execução

Backend aditivo implementado sob ORQ-01: módulo/controller/config/tipos/service e suíte focal em `apps/api/src/campanhas/`; webhook existente acrescenta respostas mínimas por hash/horário. Configuração nova encaminhada em `.env.example`, Compose e Render, sempre desativada por padrão. Guia operacional em `docs/CAMPANHAS.md`.

API gestor/admin: configuração, templates, candidatos, listagem/criação/edição, prévia, preparar/iniciar/pausar/retomar/cancelar, resultados e auditoria. Rascunho salvável sem configuração; preparar exige template real compatível. Estado intermediário recuperável de preparação. Sem envio por texto livre; somente template aprovado MARKETING com BODY simples sem parâmetros.

Revisão durante implementação corrigiu instante de agendamento após consultas externas, releitura de reserva/campanha antes do POST, retomada/cancelamento de preparação interrompida, varredura de recibos sem limite fixo que causaria starvation e exclusão de hashes dos envelopes públicos. Resultados mostram respostas recebidas sem conteúdo da conversa.

## Evidência parcial de verificação

- Build backend aprovado pelo executor.
- Primeiro focal exigiu execução fora da sandbox para criar Mongo temporário (`spawn EPERM`). Ajustada fixture do filtro global de exceção; não foi contornada autorização.
- Runner confirmado no root: `corepack pnpm --filter @captura7/api exec jest --runInBand campanhas.spec.ts whatsapp.spec.ts`, saída0, **55/55 testes,2/2 suítes**,33,563s. Base temporária e fetch simulado, nenhum envio real. Cobre permissões, rascunhoOFF, versão/autoria, filtros, elegibilidade, deduplicação, template, pausa/retomada/reinício, concorrência, cadência/lotes/teto/horários,429, resultados incertos e recibos.
- Ajuste final backend acrescentou eventos mínimos append-only por destinatário/tentativa, inclusive retry, finalização, reserva vencida e recibos, sem texto/telefone/token. Build e lint focal aprovados pelo executor; fonte API congelada antes da regressão completa.
- Runner completo confirmado no root: `corepack pnpm --filter @captura7/api test`, saída0, **247/247 testes em44/44suítes**,159,696s. Inclui a versão final dos eventos e o WhatsApp legado. Não houve envio real nem uso da base de operação.
- Menu e rotas `/campanhas` e `/campanhas/:id` adicionados à interface, com acesso gestor/admin. Página/API/CSS e testes web/E2E estão sob finalização; QA/portão finais continuam pendentes nesta anotação.

## Continuação (Claude Code) — 23/11/2026

Retomado do ponto em que a tela estava "sob finalização". Página, API do cliente, CSS, menu e rotas já estavam completos; faltava apenas fazer os testes passarem.

- **Teste web** (`PaginaCampanhas.test.tsx`): opção `exact` inexistente em `ByRoleOptions` (erro de tipo) e busca por "Aceito pela Meta", que aparece duas vezes por design (resumo + selo). Corrigido só o teste; tela inalterada.
- **E2E** (`e2e/campanhas.spec.ts`): o CRM normaliza o nome do contato para iniciais maiúsculas; o seletor passou a ignorar caixa. Comportamento da tela correto (contato sem autorização bloqueado, telefone não exibido).

Evidência (base temporária, transporte simulado, nenhum envio real):
- Web: `tsc --noEmit` OK, `eslint --max-warnings 0` OK, `vitest run` **82/82 em 27/27 arquivos**.
- E2E isolado (`node scripts/test-e2e.cjs`): **14/14**, incluindo campanhas desktop 1280px e mobile 360px sem rolagem horizontal.
- API: `corepack pnpm --filter @captura7/api test` **247/247 em 44/44 suítes**.

Pendente: CP-04 (parecer SEC-07) e CP-07 (portão REV-11), commit, e configuração externa privada pelo proprietário (número, WABA, token, template aprovado). Nenhum push, deploy ou envio realizado.

## CP-04 — Parecer SEC-07 (Segurança & LGPD)

**APROVADO COM RESSALVAS.** Conferido no código:
- RBAC: controller inteiro `@Papel('gestor','admin')`; cabeçalhos de teste recusados com `NODE_ENV=production`. E2E confirma 403 para vendedor.
- Segredos: token só no servidor (`configCampanhas`), nunca devolvido; checklist expõe apenas nomes faltantes. Chamadas à Meta em origem fixa, `redirect: 'error'`, timeout 10s, cursor de paginação limitado.
- Entrada: IDs validados por regex, textos com tipo/tamanho, busca com regex escapada (sem injeção NoSQL), cadência com limites e janelas ordenadas.
- Elegibilidade revalidada 2× antes de cada POST (consentimento `contato_comercial` ativo com versão do termo e hash, telefone E.164, bloqueio/opt-out, telefone alterado, resposta recebida). Hash do telefone idêntico ao usado em bloqueios (`whatsapp:<e164 sem +>`).
- Webhook: HMAC SHA-256 do App Secret com comparação constante antes de gravar respostas; respostas guardam só hash + horário, sem conteúdo.
- Minimização: telefone de contato inelegível não é exibido; fila guarda hash/máscara; acessos pessoais registrados em `acessos_dados` sem termo pesquisado.

Ressalvas (não bloqueiam):
1. `whatsapp_respostas` não tem expiração. Sugestão futura: TTL (ex.: 180 dias) para retenção mínima.
2. Contatos históricos digitados sem aceite documentado ficam **inelegíveis** por design. O alcance real da campanha depende de quantos contatos da feira têm consentimento registrado — ver prévia antes de solicitar o template.
3. "Dias úteis" ignora feriados; o gestor deve pausar manualmente em feriado.

Correção aplicada nesta revisão: `render.yaml` fixava `CAMPANHAS_WHATSAPP_ATIVO: 'false'`, o que faria a sincronização do Blueprint desligar o envio ligado no painel. Passou a `sync: false` (ausente = desligado pelo código).

## CP-07 — Portão REV-11

**APROVADO COM RESSALVAS PARA MERGE.** Funcionalidade completa conforme ADR-019; QA verde (API 247/247, web 82/82, E2E 14/14); envio permanece desligado por padrão e exige, nesta ordem: configuração privada completa, `CAMPANHAS_WHATSAPP_ATIVO=true`, template MARKETING aprovado idêntico à mensagem, preparação e confirmação explícita na tela. Ressalvas = as de CP-04. Pontos externos do proprietário: número/WABA/token/App Secret/verify token no painel do servidor, webhook HTTPS apontado para a API, template aprovado na Meta.
