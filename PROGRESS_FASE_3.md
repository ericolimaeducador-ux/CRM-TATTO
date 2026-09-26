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
