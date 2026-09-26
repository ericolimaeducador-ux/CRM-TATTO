# PROGRESS — FASE 3

Autorização escrita do dono (Professor Erico), 2026-09-25: "Autorizo abrir a FASE 3."

Fase em curso. O portão final fica neste arquivo quando o F3-06 fechar.

## F3-01 — Promoção com step-up

### Parecer API-03 — F3-01

Rotas criadas/alteradas: `POST /v1/contatos/:id/transicao` (papel do decorator: quem edita; cliente continua gestor/admin) aceita `codigoTotp` opcional. `POST /v1/auth/totp/inscrever` — gestor, admin.
Validação: avisos nenhum novo | erros bloqueantes `STEP_UP_NECESSARIO`, `CODIGO_TOTP_REUSADO`, `CAMPOS_OBRIGATORIOS_TRANSICAO`, `PAPEL_INSUFICIENTE`
Idempotência: o passo TOTP aceito — reenviar o mesmo código na janela não promove outro contato
Auditoria gerada por: interceptor
Campos de autoria rejeitados no DTO: sim
Casos de borda cobertos: código ausente, código errado, código dois passos fora da janela, reuso do mesmo passo, atalho de cabeçalho só fora de produção, transição negada não muda o qualificado
Ação necessária antes de seguir: sessão real em produção está escalonada; sem ela o TOTP não tem usuário

### Parecer SEC-07 — F3-01

Dado/ação envolvida: promoção qualificado→cliente e segredo TOTP por usuário
Sensibilidade: alta
Papéis com acesso e justificativa (menor privilégio): gestor e admin inscrevem o próprio autenticador e promovem; vendedor não promove; captura sem TOTP
Criptografia em repouso aplicada: sim — AES-256-GCM no segredo TOTP
Base legal registrada e não vazia: sim
Log de acesso gerado: não se aplica
Step-up exigido: sim — promoção a cliente. `x-step-up-teste` só quando `NODE_ENV` não é `production`
Nova superfície de ataque introduzida: o segredo base32 volta uma vez na inscrição e não fica em claro no banco. O mesmo passo é recusado.
Veto exercido: não

### Parecer UI-04 — F3-01

Telas/componentes criados: `/promover/:id`
Toques até o caso mínimo de captura: 2
Campo obrigatório introduzido: não na captura. Na promoção o código TOTP é obrigatório e o texto diz por quê
Estado de sincronização visível e honesto: sim
Acessibilidade: contraste ok · alvo ≥48px ok · cor+texto ok
Ação crítica com confirmação e resumo: promover resume o nome, o status e o efeito antes do botão
Testado em 360px: sim — mesmas classes das telas já medidas (`min-h-12`, `text-base`, `max-w-xl`)
Ação necessária antes de seguir: shadcn não foi instalado na fase 2; a tela segue o Tailwind já aceito. Login de produção continua escalonado.

Exceção de glob neste card: um commit só, escopo SEC-07 (maioria em `apps/api/src/auth/**`). O corpo nomeia API-03 e UI-04. O teste HTTP mora em `apps/api/test/**`, glob do QA-09, porque o aceite é a prova com a API no ar.

## F3-02 — Exportação com log

Card bloqueado. O termo de consentimento segue aberto em `.grok/ESCALONAMENTOS.md`. Não há rota de exportação, não há arquivo CSV/XLSX/JSON e não há texto jurídico redigido neste ciclo. `GET /v1/exportacoes` continua inexistente.

### Parecer SEC-07 — F3-02

Dado/ação envolvida: exportação da base
Sensibilidade: alta
Papéis com acesso e justificativa (menor privilégio): gestor e admin, quando o card existir
Criptografia em repouso aplicada: não se aplica — nada foi exportado
Base legal registrada e não vazia: não — o texto do termo não foi escrito
Log de acesso gerado: não se aplica
Step-up exigido: sim — a exportação, quando existir, pede TOTP
Nova superfície de ataque introduzida: nenhuma
Veto exercido: sim — sem termo aprovado não se exporta base

### Parecer INT-06 — F3-02

Integração: exportação — saída
Fonte e contrato: CSV, XLSX e JSON previstos na seção 8; não implementados
Comportamento em indisponibilidade: não se aplica — a rota não existe
Idempotência: não se aplica
Payload cru preservado: não se aplica
Credenciais fora do repositório: sim
Log de exportação gerado: não — o card não fechou
Sobrescreve dado digitado por humano: não
Ação necessária antes de seguir: texto do termo aprovado pelo dono

## F3-03 — Webhook de saída

Nenhum ERP foi nomeado. O contrato é genérico: `POST` no `ERP_WEBHOOK_URL` com corpo `versaoContrato: v1` e caminho `/v1/integracao/contatos-promovidos`. Assinatura `X-Captura7-Assinatura` = HMAC-SHA256 hex do corpo cru. `X-Captura7-Idempotencia` = `contatoId:versao`. Falha não desfaz a promoção. Retentativa 1s, 2s, 4s… teto 5 min. Fila em `webhooks_saida`. Log com hash do corpo, sem segredo e sem URL.

O dono precisa fornecer, para ligar um destino real: a URL que aceita esse POST JSON, o segredo HMAC compartilhado, e a confirmação de que o receptor valida `X-Captura7-Assinatura` sobre o corpo cru e trata `X-Captura7-Idempotencia` como chave de não duplicar.

### Parecer INT-06 — F3-03

Integração: webhook de saída genérico — saída
Fonte e contrato: corpo JSON `v1` em `/v1/integracao/contatos-promovidos`, HMAC-SHA256. Sem fornecedor.
Comportamento em indisponibilidade: a promoção a cliente já foi gravada; a entrega fica na fila e retenta com backoff. Sem URL ou com placeholder, status `nao_configurado` e nenhuma chamada de rede.
Idempotência: `contatoId:versao`
Payload cru preservado: sim — `corpoJson` na fila `webhooks_saida`. Não é dado de enriquecimento de terceiro.
Credenciais fora do repositório: sim
Log de exportação gerado: não se aplica
Sobrescreve dado digitado por humano: não
Ação necessária antes de seguir: URL e segredo reais do dono

## F3-04 — Backup 3-2-1

Comando: `node infra/backup/backup-321.mjs`. Ensaio de 2026-09-26 neste host, 1 contato e 1 linha de `contatos_auditoria`, chave efêmera não gravada: RPO 29 ms, RTO 19 ms (ensaio anterior: 26 ms e 15 ms), contagens iguais, amostra da trilha conferida. 3-2-1 não atendida. `docker compose up` não rodou aqui: socket do Docker negou permissão. O Compose não foi alterado.

### Parecer OPS-10 — F3-04

Ambiente/pipeline tocado: `infra/backup/backup-321.mjs`, `.env.example`, `infra/README.md`
`docker compose up` do zero funciona: não — neste ambiente o socket negou permissão; a ressalva da fase 0 segue no host, não no arquivo Compose
TLS configurado: não se aplica — o Compose continua só em 127.0.0.1
Backup: frequência o script é chamável e não há cron instalado · criptografado sim · destino externo ausente · regra 3-2-1 não
Restauração testada: sim — RTO 19 ms · RPO 29 ms, medidos neste host no volume de 1 contato e 1 linha de auditoria, não como meta de produção. Ensaio anterior: 15 ms e 26 ms.
Segredo fora do repositório: sim
Alertas ativos: profundidade da fila já existia em `GET /v1/saude`; backup sem destino não dispara alerta externo
Ação necessária antes de seguir: conta de object storage do dono e agendamento fora desta máquina

## F3-05 — Testes completos

Rodada neste host em 2026-09-26, depois dos cards anteriores: `pnpm lint` passou; `pnpm build` passou; Jest 17 suítes / 88 testes; Vitest 6 arquivos / 14 testes; Playwright 6 testes (avião, aba morta, fila presa, fusão, promoção em 360px, caminho de digitar); `bash infra/ci/varrer-segredos.sh` saiu limpa.

### Parecer QA-09 — F3-05

Categorias aplicadas: 1 funcional (código TOTP promove, webhook assina e retenta, backup restaura). 2 captura sem trava (salvar só o nome segue na suíte da fase 3 e nas anteriores; a tela de promoção não foi para a captura). 3 integridade (a transição de não-rascunho continua auditada na suíte da fase 1; não há rota de delete). 4 offline (Playwright de avião, aba morta e fila presa seguem verdes). 5 concorrência (promoção dupla da fase 1 segue verde). 6 acesso (cliente sem código continua 403; com `NODE_ENV=production` o cabeçalho de teste não autentica). 7 dedup (matriz/filial, merge sem confirmação e recuperação seguem na suíte da fase 2). Exportação da categoria 6 não tem rota: o card está bloqueado e `GET /v1/exportacoes` segue 404.
Testes escritos: `apps/api/test/f3-step-up.spec.ts`, `apps/api/test/f3-producao-step-up.spec.ts`, `apps/api/src/auth/totp-rfc6238.spec.ts`, `apps/api/src/integracoes/webhook-saida.spec.ts`, `apps/web/src/features/captura/PaginaPromover.test.tsx`, `e2e/promover.spec.ts`, mais as suítes das fases 0 a 2
Falhas encontradas: a primeira execução de `e2e/promover.spec.ts` quebrou por locator ambíguo (`Ana Promo` em dois nós). O teste foi ajustado para o botão com o nome e passou na sequência. Não foi falha de produto.
Falha silenciosa identificada (a mais perigosa): não nesta rodada. Promoção sem sessão em produção responde 403, não sucesso.
Cenários críticos cobertos nominalmente: código RFC 6238 aceito; mesmo passo recusado; código fora da janela recusado; cabeçalho de teste ignorado com a API em produção; webhook sem destino não chama a rede e não desfaz a promoção; mesma versão não duplica o POST; falha 503 retenta; placeholder não sai da máquina; captura de um nome sem TOTP; Playwright das fases 1 e 2 sem regressão
Pronto para o portão REV-11: sim
