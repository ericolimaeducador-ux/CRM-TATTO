# Tela Viva — treinamento ilustrado e planejamento pós Tattoo Week

## Despacho CC-00 — 23/11/2026

Pedido original: simular a jornada de cliente do primeiro contato à proposta/contrato, registrar prints e produzir material para a equipe. Pedido adicional: planejar e-mail e WhatsApp pós Tattoo Week, com ritmo controlado e vídeo fornecido. O proprietário esclareceu que o escopo é o CRM Tela Viva.

Cards: TR-01 simulação; TR-02 material; TR-03 QA; TR-04 revisão; CP-01 planejamento. CC-00 recebeu; ORQ-01 inventariou o aplicativo e coordenou QA-09 seguido de REV-11, sequencialmente. Sem mudança estrutural no aplicativo, migração, publicação ou ativação de campanha; nenhum ADR estrutural novo necessário para documentação/planejamento.

## Execução e entregáveis

`docs/treinamento-tela-viva/` contém guia de 62 páginas e versão HTML com ampliação, 49 prints PNG numerados, plano de campanha de 7 páginas e HTML, rascunhos de WhatsApp/e-mail, proposta fictícia de uma página, instruções de leitura e evidência resumida do cenário. Pacote de distribuição em `docs/Tela-Viva-Treinamento.zip`.

A aplicação foi compilada do checkout local e executada com API3101/web4173/Mongo temporário, sem apontar para o banco real. O frontend usa login normal, sem cabeçalhos de teste; a criação do usuário inicial usa exclusivamente a API de teste isolada. WhatsApp ficou explicitamente desligado no runtime, sem telefone de destinatário real e com ERP/Sheets desabilitados. Credenciais/sessão/TOTP de teste ficaram no diretório ignorado `test-results/`, fora do material de distribuição. Não houve alteração da operação ou de outro sistema.

Jornada exercitada no navegador: login, captura/autosave/fila, requisitos de qualificação, TOTP real e promoção, instituição e pessoa padrão, visita planejada/concluída, oportunidade, produto fictício, condição solicitada/aprovada/encerrada, proposta com contato explicitamente escolhido e total calculado pelo servidor, impressão/PDF, solicitação auditada de rascunho, proposta apresentada/aceita, oportunidade ganha, conta ativa, tarefas de formalização externa/retorno, treinamento, inscrição pública e presença. Telas auxiliares consultadas: relatórios, Meu QR, câmera sem dispositivo, busca, duplicatas, planilha, usuários, Minha conta e mobile390px.

Conferência final da API: contato `cliente`, oportunidade `ganho`, proposta `180000` centavos (20 × R$100 −10% = R$1800). Zero envios externos. A preparação do roteiro usou retomadas: o servidor corretamente exigiu documento/endereço para transições e pessoa de contato explícita para o rascunho. Esses requisitos constam no guia; não foram contornados.

## Limites de produto e do planejamento

- Não existe módulo/editor/upload/assinatura de contratos. O guia documenta a tarefa e o encaminhamento externo; a proposta fictícia não é contrato.
- Aceite, ganho e relacionamento são estados independentes. Preço aprovado não altera proposta automaticamente.
- E-mail atual é `mailto`, com solicitação auditada, sem anexo/envio automático. Não foi enviado e-mail na simulação.
- Campanha histórica, tela de público, cadência global/pausa e envio de e-mail são propostas, não funcionalidades novas implementadas. A fila existente de boas-vindas não envia para toda a base histórica.
- Plano inclui seleção/deduplicação, autorização/opt-out, template aprovado, piloto, ritmo configurável, limites reais da conta, backoff e resultados incertos. Intervalos não garantem ausência de bloqueio. Número/provedor, remetente, quantidade e comprovação da autorização continuam a confirmar para uma implementação futura.
- Vídeo: mesmo ID encontrado na página local da Tela Viva com apresentação da BioCic. Transcrição não obtida; rascunho se baseia na descrição e não afirma resumo completo conferido nem eficácia clínica. Política atual da Meta foi consultada; fontes estão no plano.

## QA-09

Build da API e build do web isolado concluídos; scripts novos passam `node --check`, e `git diff --check` passou. Não houve alteração de lógica do produto, portanto não se repetiu a regressão geral de API/web.

Conferidos:49etapas/49imagens únicas existentes, links relativos dos prints e carregamento de todas as imagens na geração; PDFs iniciam com `%PDF`, terminam com EOF e têm62/7/1páginas; inspeção de layout de59seções do guia e6seções do plano, sem seção acima de695px disponíveis. Maior altura observada do guia636px. Inspeção visual por amostragem de capa, proposta, impressão, TOTP, conta e mobile. Os PDF podem ter páginas adicionais por paginação de conteúdo; não foram renderizados/revisados individualmente em todas as páginas.

Categorias QA: funcional e captura permissiva exercitadas no cenário; integridade observada pelos estados e respostas sem mudança do contrato. Offline completo, concorrência, recuperação destrutiva e matriz de RBAC não reexecutados: nenhum código desses recursos foi alterado. Login/admin/TOTP foram usados na base isolada. Câmera física, integrações e envios reais não testados; limites explícitos no guia.

Achado QA corrigido: validade de QR passou a ser descrita como padrão de2h/1cadastro, sujeita à configuração do ambiente. Print25 reenquadrado para mostrar destinatário explícito, itens e totais. HTML/PDF regenerados após as correções e novamente conferidos pelo REV.

## REV-11 — parecer final após QA e regeneração

### Correção funcional

Aprovado com ressalvas de escopo. Material corresponde às ações e requisitos observados; contrato externo e estados independentes claros. Nenhuma funcionalidade de campanha é apresentada como entregue.

### Integridade e auditoria

Aprovado para entrega documental. Base temporária, zero dados reais alterados; transições e rascunho passaram pelas rotas existentes. Captura permissiva preservada. Nenhuma migração nem alteração de auditoria do produto.

### Segurança e escala

Aprovado para material interno. Nenhum segredo nos artefatos distribuídos identificado; senha/código/segredo não fotografados. Não ativou WhatsApp, não enviou mensagens e não promete ausência de bloqueio. Escala real requer implementação/validação própria.

### Conselho de design

1. Trilha imutável: preservada; cenário usa rotas do aplicativo existente.
2. Captura sem campo obrigatório: sim; captura inicial só com nome registrada.
3. Responsável identificado: sim; usuário de treinamento autenticado nas operações.
4. Sincronização honesta: sim; aparelho/fila/servidor explicados separadamente.
5. Carga cognitiva: reduzida por prints, passos, resultado esperado, perfis e exercício.
6. Quebra de fluxo existente: não; sem mudança no código do aplicativo.

**VEREDITO: APROVADO COM RESSALVAS para treinamento interno e apresentação do plano, sem bloqueios pendentes.** Não é autorização/implementação de envio em massa nem revisão humana, jurídica ou do áudio integral do vídeo. Revisão visual amostral; não houve teste de provedores externos ou reexecução independente completa da jornada pelos revisores.
