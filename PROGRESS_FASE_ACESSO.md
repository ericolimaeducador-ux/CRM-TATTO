# Acesso e equipe — 19/11/2026

Pedido: corrigir acesso ao CRM Tela Viva, simplificar login removendo 2FA dessa tela e disponibilizar administrador que crie usuários da equipe.

Despacho CC-00: AC-02 API-03 → AC-03 UI-04 → AC-04 QA-09 → AC-05 REV-11 → AC-06 OPS-10. Sem escalonamento: autorização explícita do proprietário substitui exigência histórica de TOTP na entrada. Governança da captura preservada. ORQ-01 coordena execução sequencial.

Diagnóstico: login exige TOTP para inscritos e a validação de sessão bloqueia administrador sem inscrição, inclusive gestão de usuários. Gestão de usuários já existe com RBAC admin. Docker Desktop desligado na primeira conferência; aplicação local precisa ser iniciada antes da validação real.

Decisão: ADR-017. Ciclo concluído: AC-02 a AC-07 feitos, API195, web48, E2E11, lint e builds finais aprovados. REV-11 liberou e a implantação local foi aplicada e conferida. Após pedido do proprietário para receber a senha, AC-07 redefiniu somente sua credencial administrativa e confirmou login real, acesso à gestão e encerramento da sessão de teste, sem registrar senha neste repositório.

## AC-02 — API implementada, aguardando QA

API-03 removeu o desafio TOTP de `entrar` e manteve sessões novas sem step-up. A validação continua consultando perfil e estado ativo do usuário, sem bloquear a sessão normal por inscrição pendente. RBAC e confirmação adicional das operações sensíveis permanecem. Nenhum schema ou dado real foi alterado.

Regressões escritas antes da correção para usuário inscrito entrar sem código, administrador criar/listar equipe sem inscrição, vendedor sem permissão administrativa e limite de oito senhas incorretas. A primeira execução encontrou `spawn EPERM`; repetição escalada comprovou os três cenários vermelhos esperados antes da implementação. ESLint focal e build API passaram após a correção. Testes posteriores à implementação serão consolidados por QA-09; AC-02 ainda não é considerado pronto.

## AC-03 — interface implementada, aguardando QA

UI-04 separou `/entrar` do menu comercial: usuário/senha, mostrar senha e envio protegido contra duplicação; sucesso confirmado pela API leva ao painel. Token local antigo não impede abrir a entrada para recuperar sessão expirada. A nova `/minha-conta` concentra troca de senha, logout, confirmação opcional para operações sensíveis e planilhas conforme perfil. Links e mensagens apontam à nova rota.

Gestão de usuários apresenta perfis legíveis e explica que Administrador cria outros acessos; inclui carregamento, falhas de rede, proteção contra envio duplicado e resumo antes de alterações sensíveis. Nenhum campo obrigatório foi acrescentado à captura. TypeScript e ESLint web passaram. QA-09 adaptará testes antigos da entrada e conferirá 360px e fluxo integrado antes do aceite.

## AC-04 — cobertura escrita, execução funcional pendente

QA-09 adaptou `PaginaEntrar.test.tsx` (5 casos), criou `PaginaMinhaConta.test.tsx` (3) e `PaginaUsuarios.test.tsx` (3), além de `e2e/acesso.spec.ts` (1 fluxo). A nova prova integrada usa apenas Mongo temporário/API3101: administrador inscrito em TOTP entra sem código, cria membro, encerra a sessão; membro entra e recebe403 ao tentar criar usuário. Também verifica login sem menu, largura360px e alvo48px.

Categorias1 e6 aplicadas diretamente e5 na prevenção de envio duplicado; categorias2,3,4 e7 ficam na regressão existente porque persistência/captura/merge não foram alterados. TypeScript web e ESLint dos quatro testes passaram. Nenhum bug de implementação identificado na inspeção. Os testes funcionais ainda não têm resultado confirmado: web bloqueou antes de iniciar por `spawn EPERM` no esbuild; a chamada API escalada ficou aguardando aprovação por556s e foi abortada sem resultado. CC-00 recebeu os comandos para execução fora do sandbox. AC-04 continua aberto e ainda não libera REV-11.

## AC-06 — preparação documental

OPS-10 atualizou somente os trechos de acesso em `README.md`, `INSTALAR-WINDOWS.md`, a mensagem final de `apps/api/scripts/criar-admin.mjs` e criou `docs/ACESSO.md`. A entrada usa usuário/senha; administrador cria equipe em `/usuarios`; senha, logout, planilhas e TOTP de operações sensíveis ficam em `/minha-conta`. O comportamento do script de criação foi preservado. `node --check` e `git diff --check` passaram. Nenhum comando de usuário, dado real, TLS ou segredo foi alterado nessa preparação. Implantação continua pendente de QA e REV-11.

## QA consolidado e retorno focal de revisão

CC-00 confirmou execução fora do sandbox: API **195/195 em38 suítes**, web **48/48 em19 arquivos**, lint completo aprovado. Base efetiva preservada:3 usuários ativos (2 administradores e1 vendedor),5 contatos; administrador do proprietário ativo. Serviços Docker antigos restabelecidos e saudáveis; implementação nova ainda não aplicada.

REV-11 encontrou AC-05-R1: o efeito que aplica `inert` no menu móvel só dependia de `aberto`; após transição de `/entrar` sem menu para o painel, a sidebar nova podia ficar no tab order enquanto oculta. UI-04 corrigiu exclusivamente a dependência para `[aberto, local.pathname]`; TypeScript e lint focal passaram. QA-09 acrescentou a verificação de `inert` após login ao E2E existente e corrigiu seu seletor de perfil para role `combobox`; lint focal passou. A rodada E2E anterior passou10/11 e parou apenas nesse seletor; não é aceite final. CC-00 repetirá E2E completo sem sobreposição de build e fará build de produção final em seguida antes do retorno ao REV-11.

## AC-05 — revisão final REV-11 para implantação local

Evidências fornecidas pelo CC-00: API **195/195 em 38 suítes** (133,354s, saída0), web **48/48 em 19 arquivos** (24,23s, saída0) e lint geral com saída0. Após a correção focal, a execução E2E isolada sem sobreposição passou **11/11 em29,1s**, saída0. O fluxo de acesso passou em2,6s, incluindo administrador previamente inscrito em TOTP entrando sem código, criação de membro, logout, login do membro, recusa403 à criação indevida e `inert` no menu móvel. O build final root pós-E2E passou com saída0 (sessão44324, API e web de produção,36 entradas PWA); o build Docker final de API/web também passou com saída0 (sessão41983), já com a correção `inert`. Nenhum backend foi alterado após as suítes API/web. Base efetiva conferida pelo CC-00:3 usuários ativos (2administradores e1vendedor),5 contatos, administrador `erico.telaviva` preservado. Esta versão ainda não foi aplicada; a conferência pós-implantação pertence a AC-06.

### Parecer Dev 1 — Correção funcional
- **Aprovado.**
- AC-05-R1 corrigido: o efeito de `Layout.tsx` agora depende de `[aberto, local.pathname]`, reaplicando `inert` quando o sidebar surge após o login. A regressão integrada verifica o atributo em viewport móvel e passou. O seletor de perfil foi corrigido para role `combobox`; nenhuma regra de produto mudou nesse ajuste de teste.
- Entrada simplificada, separação de conta e criação de membros pelo administrador estão cobertas pelos testes. Sem achados novos pendentes na revisão focal.
- Ação necessária antes da implantação: nenhuma correção ou validação técnica pendente.

### Parecer Dev 2 — Integridade de dado e auditoria
- **Aprovado com ressalvas de baseline.**
- Não há alteração de schemas, índices, captura, fila, merge ou trilhas de contatos/comercial. A troca de senha mantém o evento existente sem senha em claro; a criação de usuário continua sem sobrescrever login existente.
- A gestão de usuários já não registra evento dedicado para criação/alteração de perfil no serviço existente. Isso antecede este ciclo: não foi introduzido nem resolvido pela simplificação do login, e não é tratado como escopo novo obrigatório nesta entrega.
- Ação necessária no AC-06: conferir preservação da base após aplicação. Nenhuma migração proposta; regressão concluída.

### Parecer Dev 3 — Segurança e escala
- **Aprovado.**
- A remoção de 2FA da entrada está expressamente autorizada na ADR-017. Login novo nunca concede step-up; confirmação sensível continua separada, RBAC servidor restringe gestão ao administrador e a sessão consulta perfil/estado ativo atual. Hashes, prazo da sessão e limite de senhas incorretas são preservados. Nenhum segredo foi acrescentado aos arquivos da entrega; a senha do E2E pertence somente à base temporária.
- O fluxo integrado confirmou recusa administrativa para o membro e ausência de step-up no login do administrador inscrito. Ação necessária no AC-06: aplicar a versão local sem trocar credenciais ou dados existentes.

### Conselho de Design (auditoria de premissa)
1. Trilha imutável? **Sim, quanto à preservação das trilhas existentes no escopo alterado.** O mecanismo de auditoria de contatos/comercial permanece intacto. A ausência preexistente de evento dedicado na gestão de usuários está explicitada no parecer Dev2; não se declara cobertura universal inexistente.
2. Captura sem campo obrigatório? **Sim.** Os campos obrigatórios acrescentados pertencem a login e criação de usuário, não à coleta de leads.
3. Responsável identificado em toda ação? **Sim no escopo autenticado.** Sessão e RBAC continuam exigindo identidade real do usuário; não foi criada ação anônima de gestão.
4. Estado de sincronização honesto? **Sim.** Não houve alteração da fila ou das promessas de persistência.
5. Carga cognitiva reduzida? **Sim**, pela entrada separada de configurações; a regressão do menu móvel foi corrigida e coberta.
6. Quebra fluxo existente? **Não.** Captura, dedup, auditoria e navegação móvel estão preservados na regressão final.

**VEREDITO DO PORTÃO: APROVADO COM RESSALVAS PARA IMPLANTAÇÃO LOCAL.** Pareceres: Dev1 aprovado; Dev2 aprovado com ressalva preexistente; Dev3 aprovado; Conselho aprovado. Não há reprovação individual, correção de código, teste ou build pendente. A implantação local pode seguir. A ausência preexistente de evento dedicado de gestão de usuários permanece registrada como baseline, sem ampliar o escopo autorizado. A entrega operacional depende somente da conferência de saúde e preservação dos dados no AC-06.

Observação: este portão prepara material de revisão e não substitui revisão humana quando exigida pelo processo da empresa.

## AC-06 — implantação local conferida e ciclo fechado

CC-00 aplicou `docker compose up -d --no-deps api web` com saída0. API saudável na porta3000, web80/443 e Mongo27019. Conferência no container aplicado:3 usuários e5 contatos preservados; `erico.telaviva` com papel administrador e ativo; saúde200; gestão de usuários sem sessão403; `WHATSAPP_ENVIO_ATIVO:false`; código implantado com entrada sem desafio TOTP e sessão normal sem bloqueio de inscrição. Nenhum usuário ou senha foi alterado e nenhum dado foi removido.

Navegador HTTPS confirmou a nova entrada sem menu e sem código do autenticador, campos usuário/senha e opção mostrar senha. Bundle servido `index-BQVi_dLW.js`; viewport360px com `scrollWidth360`. Captura visual `.playwright-mcp/page-2026-11-19T21-14-09-900Z.png` conferida e aprovada. A primeira navegação ainda usou cache antigo do service worker; atualização do registro e reabertura carregaram a versão nova. Se a interface antiga aparecer, feche e reabra o CRM ou use **Ctrl+Shift+R** no computador.

Acesse `https://localhost/entrar` com o usuário administrador **erico.telaviva** e sua senha existente. Em **Usuários**, cadastre Nome, Usuário, Senha de12 caracteres ou mais e Perfil; Administrador também pode criar outros administradores. Configurações ficam em **Minha conta**. O login da conta real do proprietário não foi testado, pois sua senha não estava disponível; login real com sessão e criação de membro foram validados exclusivamente na base temporária do E2E.

Limite da conferência de transporte: curl do Windows falhou na verificação de revogação da CA local; esse comando não foi considerado aprovado. O acesso HTTPS no navegador funcionou. Sem publicação GitHub nem alteração de configuração externa.

Consolidação ORQ-01: AC-02, AC-03, AC-04, AC-05 e AC-06 concluídos; ADR-017 aplicado; único achado novo AC-05-R1 corrigido e coberto. BOARD sem cards em curso ou revisão. Ciclo fechado após REV-11 e conferência operacional, mantendo a ressalva preexistente da auditoria dedicada de gestão de usuários.

## AC-07 — acesso real do proprietário validado em 19/11/2026

Após pedido expresso do proprietário para receber a senha na conversa, a senha antiga não estava disponível: somente seu hash persistido existia. SEC-07/OPS-10/REV-11 revisaram e aprovaram a redefinição cirúrgica da conta existente `erico.telaviva`, com senha aleatória gerada em memória e hash pelo mecanismo scrypt já usado pela aplicação. Nenhum segredo foi escrito em arquivo ou passado como argumento de comando.

CC-00 confirmou execução bem-sucedida: atualização condicionada ao `_id` do administrador, login exato, estado/perfil existentes e hash anterior modificou exatamente1 usuário. Nome, perfil, estado ativo e TOTP permaneceram intactos. Foi inserido em `auth_auditoria` o evento `redefinicao_senha_proprietario`, com identificador do usuário e horário, sem senha ou outro segredo. Uma sessão anterior desse usuário foi revogada.

Validação na aplicação real: `POST /v1/auth/entrar` retornou201 com a credencial nova; `GET /v1/usuarios` retornou200 usando a sessão emitida; `POST /v1/auth/sair` retornou200, encerrando a sessão de conferência. O processo encerrou com saída0. Diferentemente da conferência anterior AC-06, o login real da conta do proprietário agora foi exercitado e confirmado. Não foi criado membro fictício na base real. Contagens preservadas:3 usuários e5 contatos.

A credencial permanece somente na memória da execução e na resposta privada ao proprietário nesta conversa; não há senha neste documento ou no BOARD. A criação de equipe pelo administrador segue disponível em **Usuários**. Revisão operacional encerrada sem necessidade de novos testes ou alteração de código; AC-07 concluído e ciclo fechado.

## Continuação AC-08 a AC-11 — depuração de contatos e navegação

Em nova solicitação de depuração no navegador, CC-00 confirmou autenticação administrativa e respostas200 em sessão, usuários e painel. O painel comercial com totais zero corresponde à ausência de registros comerciais e não indica falha. A inconsistência reproduzida está em **Contatos**: a interface consultava somente o IndexedDB do aparelho e mostrava lista vazia, enquanto a API autorizada retornava5 contatos existentes (3 capturados e2 rascunhos). Outra falha reproduzida: a posição de rolagem da seção anterior era mantida na troca de rota.

Despacho sequencial: UI-04 corrige consulta paginada dos contatos do servidor junto aos rascunhos locais e retorno ao topo na troca de seção; QA-09 valida sessão, deduplicação, pendências offline, paginação/erro e navegação; REV-11 revisa antes de aplicação local pelo CC-00. Não há alteração de backend, permissões, schemas ou migração. Registros remotos não serão copiados ao IndexedDB nem sobrescreverão a fila. Pendências locais mantêm prioridade e seu indicador honesto; registros do servidor abrem a rota de lead existente.

O navegador compartilhado foi restaurado pelo CC-00 para desktop1440×1000; o tamanho360px usado na prova móvel anterior não deve permanecer como apresentação final. Não foram identificadas falhas atuais de rede;403 histórico veio de diagnóstico sem sessão e não é tratado como erro atual. AC-08 a AC-11 permanecem abertos até QA/REV e conferência operacional.

### AC-09 e AC-10 — implementação enviada a QA

UI-04 alterou somente `ListaContatos.tsx` e `Layout.tsx`: consulta paginada de `/v1/contatos?limite=20`, cursor existente, deduplicação por identificador remoto/local e prioridade das pendências locais. Remotos ficam em memória apenas com nome/status e link para lead; não há gravação no IndexedDB ou na fila. Logout/troca de sessão limpam remotos; abort, geração e chave de sessão rejeitam respostas antigas. Erros, carregamento, atualização e paginação têm estados explícitos. Sem token, a captura local permanece disponível.

O efeito de troca de `pathname` leva ao topo; mudança somente de query não reinicia rolagem ou consulta. TypeScript web e lint focal passaram. QA-09 validará listagem remota sem locais, dedup/pendência,401/403, paginação com clique duplicado, resposta antiga após troca de sessão, offline e navegação. A execução funcional será feita pelo CC-00 fora do sandbox.
