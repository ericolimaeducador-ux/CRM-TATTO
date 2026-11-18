# Tela Viva — reformulação para representantes comerciais

## Despacho CC-00 — 16/11/2026

Pedido: transformar o CRM aberto em Tela Viva, voltado ao setor farmacêutico e de produtos médicos. Foco confirmado: representantes comerciais gerenciando carteiras e visitas.

Interpretação: CRM comercial B2B com carteira por representante, agenda e registro de visitas, oportunidades, catálogo representado e propostas internas. Preservar captura por QR/manual, rascunhos permissivos, IndexedDB e integrações existentes. Não criar prontuário, faturamento, controle de estoque nem alegar certificação regulatória.

Cards: TV-01 (dados), TV-02 (API/segurança), TV-03 (interface), TV-04 (QA), TV-05 (portão). Despachados sequencialmente por ORQ-01; nenhuma implementação bloqueada por decisão do usuário. ADR-011 registra o contrato aditivo e a compatibilidade dos identificadores internos.

## Avaliação inicial e evidência

- Monorepo React/Vite + NestJS + MongoDB. A base existente já tem captura offline, QR, PF/PJ, normalização, deduplicação, fusão, promoção, TOTP, exportação e consentimento.
- Antes da reformulação: **124 testes API, 26 testes web, build e lint passaram** neste Windows (Node 24.15.0, pnpm 10.33.3 via corepack).
- Os scripts raiz que chamam `pnpm` falham quando somente o shim `corepack` está disponível. `corepack pnpm -r --if-present <comando>` executou os checks. A sandbox bloqueou subprocessos (EPERM); checks foram repetidos com a permissão nativa do executor.
- Riscos encontrados por leitura: sessão usava papel/ativo da emissão em vez de consultar o usuário atual; fila pode remover edições feitas durante um POST em andamento; IndexedDB sinaliza request antes de commit; fusão de dois documentos sem transação. A sessão entra no TV-02; os demais precisam ser considerados no portão e corrigidos antes de declarar robustez offline completa.
- A geração de grafo foi limitada ao inventário: runtime TypeScript confirmado e 236 arquivos detectados; não foi gerado grafo semântico nem alegado resultado desse grafo. A avaliação principal usou leitura direta e execução dos checks.
- Alterações de Docker/Compose, `.gitignore`, `.gitattributes` e override já estavam presentes antes desta tarefa e devem ser preservadas.

## Referências funcionais

Padrões de produto consultados (inspiração funcional, sem cópia de marca/interface):

- [Veeva — Accounts overview](https://crmhelp.veeva.com/doc/Content/CRM_topics/Accounts/AcctOverview.htm): conta no centro de interações e planejamento.
- [Veeva — Call planning](https://crmhelp.veeva.com/doc/Content/CRM_topics/Scheduling_Planning/CallPlanning/CPOverview.htm): agenda com contexto da carteira.
- [Salesforce — Visit management](https://developer.salesforce.com/docs/industries/life-sciences-dev-guide/guide/life-sciences-provider-visit-management.html): planejar, executar e registrar visitas.

## Execução e portão

Implementação e QA local concluídos em 16/11/2026. O escopo do despacho está disponível localmente no Docker; este documento registra o portão técnico, evidências e limites do que foi exercitado.

### TV-01/TV-02 — backend implementado

Entidades, validação, carteira, versão, arquivamento lógico, cálculo das propostas e painel foram adicionados em `apps/api/src/comercial/`. A metadata usa `secao` para preservar o campo `tipo` das atividades. A leitura da sessão agora consulta o perfil/estado atual do usuário; reset do autenticador revoga suas sessões. A versão do termo é `2026-11-16-tela-viva-jsette7`, conforme ADR-013.

Validação parcial pós-backend: suíte HTTP comercial e suítes de usuários/sessão passaram; a execução agrupada terminou com saída nativa Windows `3221226505` antes de confirmar a suíte do termo. Lint dos arquivos backend alterados passou. Regressão completa continua pendente; não considerada verde por inferência.

### Ambiente Docker confirmado pelo usuário

Em 16/11/2026 o usuário informou que ligou o Docker. Mongo exposto em `127.0.0.1:27019`, API em `127.0.0.1:3000`, web em 80/443. Antes da reconstrução: 0 contatos, 1 usuário, 0 registros comerciais na base `captura7`. As imagens foram atualizadas sem recriar volumes; contagens conferidas novamente após a atualização.

### Fonte oficial de marca

Usuário indicou `C:\Users\erico\telaviva` como fonte de informações, logo e ícones. Fonte lida: README/CLAUDE, index.html, CSS, política de privacidade e arquivos de marca. A direção visual passa a respeitar os assets originais e a paleta areia/blush/sálvia (ADR-012). O foco comercial inclui estúdios de tatuagem e profissionais autônomos, com catálogo de cosméticos/kits, sem preços inventados. A identificação do controlador legal está aguardando a resposta do usuário porque o site e o CRM histórico diferem.

### Identidade empresarial confirmada

Usuário confirmou: **JSETTE7, conforme os dados do site**, para consentimento e propostas. ADR-013 substitui a identificação pessoal histórica nas novas telas. Termo com versão `2026-11-16-tela-viva-jsette7`, nome/CNPJ/endereço/canal copiados da fonte oficial, sem reescrever consentimentos históricos. A questão em ESCALONAMENTOS está resolvida.

### TV-03 — interface implementada e conferida

Shell responsivo e módulos painel/carteira/detalhe/agenda/funil/produtos/propostas conectados. Assets e fontes oficiais locais; emissão impressa de propostas identifica JSETTE7. Root conferiu no navegador: logo correto, tema areia/blush/sálvia e nenhuma rolagem horizontal em 360 px (`scrollWidth == innerWidth == 360`). Screenshot de conferência `tela-viva-desktop.png`. TypeScript e ESLint web passaram. **28 testes web em 14 arquivos passaram** após a interface; API build também passou.

Itens encontrados durante integração e resolvidos antes do aceite:

- Marca/termo, enums, acesso por carteira e sessões foram alinhados e cobertos por testes.
- Dashboard usa contagens agregadas e próximos compromissos limitados.
- Manifesto PWA inclui ícone quadrado; build de produção gerou service worker e precache. Drawer móvel fechado fica inert, fecha por Escape e devolve o foco.
- Runner E2E Node usa API isolada na porta 3101, Mongo temporário e preview 4173. Proxy dos testes também força 3101; a API Docker na porta 3000 não recebe chamadas de QA.
- Corrigidos os seletores acessíveis dos campos, a navegação da fila em mobile e o overflow horizontal da tabela.
- A regressão final e a verificação pós-Compose estão registradas abaixo.

### QA final — regressão unitária/integração

`corepack pnpm -r --if-present test` concluiu com sucesso: **132 testes API em 33 suítes e 34 testes web em 16 arquivos**. ESLint geral passou. `corepack pnpm -r --if-present build` passou (API, TypeScript web, Vite e service worker PWA de produção). `corepack pnpm test:e2e`: **9/9 passaram**, cobrindo captura offline após fechar/reabrir, CRM comercial (conta, visita, oportunidade, proposta e impressão JSETTE7), navegação móvel, fila presa, fusão, promoção, termo/QR e toque a 360 px. E2E usou Mongo temporário e integrações externas desligadas.

### Portão REV-11 — aprovado para uso local, com ressalvas de escopo

Revisão final em três frentes: (1) isolamento do schema comercial, autoria/escopo/concorrência e auditoria; (2) integridade de IndexedDB/sync e preservação das rotas de captura; (3) fluxo de representantes, acessibilidade, viewport móvel, marca e identidade legal. Não há migração destrutiva nem dados seed; a base real permaneceu com 0 contatos, 1 usuário e 0 registros comerciais após a implantação. Somente `api` e `web` foram reconstruídos; volumes Mongo, segredos e certificados foram mantidos.

**Ressalvas:** CRM exige sessão e conexão; somente captura/QR/fila são offline. Câmera física, integrações reais de terceiros e envio de propostas não foram exercitados; envio externo continua desativado sem configuração e consentimento. A fusão histórica de dois contatos ainda não usa transação Mongo multi-documento. O Compose local usa certificado CA local, cuja confiança precisa ser instalada em outros aparelhos. Esses limites não bloqueiam o CRM local nem os fluxos validados.

### TV-07 — arte para camiseta preta

Solicitação adicional do usuário: logo oficial com slogan para as costas de camiseta preta. Entregues em `artes/camiseta/`: SVG transparente com fontes oficiais embutidas, PNG transparente6000×1800 com508dpi (30×9cm) e preview1000×300 sobre preto. Cor clara original#FBF7F1; slogan oficial `CUIDADOS PARA PELE TATUADA`. Script de exportação executado com sucesso, canal alfa e dimensões validados, preview conferido visualmente sem cortes. O repositório fonte permaneceu somente leitura.
